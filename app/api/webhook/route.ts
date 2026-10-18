import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// ใช้เก็บข้อความล่าสุดที่ User พิมพ์มาก่อนส่งวิดีโอ (Key: userId, Value: textMessage)
const userLastMessage = new Map<string, string>();

function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// ฟังก์ชันช่วยส่งข้อความ LINE (รองรับทั้ง Reply และ Push เข้ากลุ่ม)
async function sendLineMessage(replyTokenOrTo: string, text: string, isGroup: boolean = false, sourceId?: string) {
  const url = isGroup 
    ? 'https://api.line.me/v2/bot/message/push' 
    : 'https://api.line.me/v2/bot/message/reply';

  const body = isGroup ? {
    to: sourceId,
    messages: [{ type: 'text', text: text }]
  } : {
    replyToken: replyTokenOrTo,
    messages: [{ type: 'text', text: text }]
  };

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-line-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const bodyText = await req.text();
    
    if (!verifySignature(bodyText, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(bodyText);
    const events = body.events;

    for (const event of events) {
      if (event.type === 'message') {
        const userId = event.source.userId;
        const messageType = event.message.type;

        // 1. กรณีช่างพิมพ์ข้อความมาก่อน
        if (messageType === 'text') {
          const textMessage = event.message.text.trim();
          console.log(`ได้รับข้อความจาก ${userId}: ${textMessage}`);
          userLastMessage.set(userId, textMessage);
        }

        // 2. กรณีส่งวิดีโอเข้ามา
        else if (messageType === 'video') {
          // 📌 ตรวจสอบสถานะการตั้งค่าจากฐานข้อมูลว่าอนุญาตให้บันทึกวิดีโอหรือไม่
          const setting = await prisma.systemSetting.findUnique({
            where: { id: 'default' },
          });
          const isSaveVideoEnabled = setting ? setting.lineOaSaveVideo : true;

          if (!isSaveVideoEnabled) {
            console.log(`⏸️ ข้ามการบันทึกวิดีโอ เนื่องจากฟังก์ชันถูกปิดใช้งานในตั้งค่าระบบ`);
            continue;
          }

          const messageId = event.message.id;
          console.log(`ได้รับไฟล์วิดีโอ (Message ID: ${messageId}) จาก ${userId}`);

          // ดึงไฟล์วิดีโอจาก LINE Messaging API
          const videoRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
            headers: {
              Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
          });

          if (videoRes.ok) {
            const arrayBuffer = await videoRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // สร้างโครงสร้างโฟลเดอร์แยกตาม ปี และ เดือน (เช่น public/uploads/videos/2026/09)
            const now = new Date();
            const yearStr = now.getFullYear().toString();
            const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');

            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos', yearStr, monthStr);
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }

            // ดึงข้อความที่ช่างพิมพ์ไว้ก่อนหน้านี้
            const rawText = userLastMessage.get(userId) || 'UnknownText';

            // แกะหาเลข SN 4 ตัวท้ายจากข้อความ
            const snMatch = rawText.match(/(?:sn[-:\s]*)?(\d{4})/i);
            const serial4Digits = snMatch ? snMatch[1] : 'NoSN';

            // จัดรูปแบบข้อความสำหรับตั้งชื่อไฟล์
            const safeTextInfo = rawText
              .replace(/[\/\\?%*:|"<>]/g, '-')
              .replace(/\s+/g, '_');

            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
            const dateTimeCode = `${dateStr}_${timeStr}`;

            const fileName = `${safeTextInfo}_${serial4Digits}_${dateTimeCode}.mp4`;
            const filePath = path.join(uploadDir, fileName);

            // บันทึกไฟล์ลงโฟลเดอร์
            fs.writeFileSync(filePath, buffer);
            
            const dbVideoPath = `/uploads/videos/${yearStr}/${monthStr}/${fileName}`;
            console.log(`บันทึกวิดีโอสำเร็จที่: ${filePath}`);

            // บันทึกข้อมูลลงตาราง TestVideo ในฐานข้อมูล
            await prisma.testVideo.create({
              data: {
                messageId: messageId,
                userId: userId,
                serialNo: serial4Digits !== 'NoSN' ? serial4Digits : null,
                videoPath: dbVideoPath,
                jobId: null,
              },
            });

            console.log(`บันทึกข้อมูลลงฐานข้อมูลเรียบร้อยแล้ว`);

            // 🔍 ตรวจสอบสถานะการเบิกอะไหล่จากเลข SN 4 ตัวท้าย
            if (serial4Digits !== 'NoSN') {
              const isAlertEnabled = setting ? setting.lineOaAlertEnabled : true;

              if (isAlertEnabled) {
                const targetJob = await prisma.job.findFirst({
                  where: {
                    serialNumber: {
                      endsWith: serial4Digits,
                    },
                  },
                  include: {
                    stockLogs: true, 
                  },
                  orderBy: { createdAt: 'desc' },
                });

                // ถ้าเจอใบงาน แต่ยังไม่มีประวัติการเบิกอะไหล่ ส่ง LINE เตือน (ข้อความแบบสั้นกระชับตามต้องการ)
                if (targetJob && (!targetJob.stockLogs || targetJob.stockLogs.length === 0)) {
                  const warningText = `⚠️ [Alert] แจ้งเตือนเบิกอะไหล่ SN: [${serial4Digits}] ยังไม่ได้ทำรายการเบิกอะไหล่ (Spare Parts Not Issued) กรุณาตรวจสอบครับ`;

                  const sourceId = event.source.groupId || event.source.roomId || event.source.userId;
                  const isGroup = !!event.source.groupId || !!event.source.roomId;

                  await sendLineMessage(event.replyToken, warningText, isGroup, sourceId);
                }
              } else {
                console.log(`🔕 ข้ามการส่งข้อความแจ้งเตือน เนื่องจากฟังก์ชันแจ้งเตือนถูกปิดใช้งานในตั้งค่าระบบ`);
              }
            }

            // ล้างข้อความชั่วคราวของ User นี้
            userLastMessage.delete(userId);

          } else {
            console.error('ไม่สามารถดาวน์โหลดวิดีโอจาก LINE ได้:', await videoRes.text());
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}