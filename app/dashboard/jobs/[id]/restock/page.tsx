import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import RestockClient from './RestockClient';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function RestockPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const jobFromDb = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      jobNo: true,
      customerName: true,
    },
  });

  if (!jobFromDb) {
    notFound();
  }

  const job = {
    ...jobFromDb,
    customerName: jobFromDb.customerName ?? undefined,
  };

  const spareParts = await prisma.sparePart.findMany({
    select: {
      id: true,
      code: true,          
      boardModelCode: true,   
      name: true,            
      model: true,           
      location: true,        
      stock: true,            
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <RestockClient
      params={resolvedParams}
      job={job}
      spareParts={spareParts}
    />
  );
}