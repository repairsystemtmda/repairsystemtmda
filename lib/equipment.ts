import { Sun, Sliders, SunMedium, BatteryCharging, Droplets } from 'lucide-react';

export const EQUIPMENT_CATEGORY_CONFIG = {
  INVERTER: {
    name: 'Inverter',
    symbol: '☀️',
    icon: Sun,
    color: 'text-amber-500 bg-amber-50',
  },
  OPTIMIZER: {
    name: 'Optimizer',
    symbol: '🎛️',
    icon: Sliders,
    color: 'text-blue-500 bg-blue-50',
  },
  MICRO_INVERTER: {
    name: 'Micro Inverter',
    symbol: '🌤️',
    icon: SunMedium,
    color: 'text-orange-500 bg-orange-50',
  },
  BATTERY: {
    name: 'Battery / BMS',
    symbol: '🔋',
    icon: BatteryCharging,
    color: 'text-emerald-500 bg-emerald-50',
  },
  SOLAR_PUMP: {
    name: 'Solar Pump Inverter',
    symbol: '💧',
    icon: Droplets,
    color: 'text-cyan-500 bg-cyan-50',
  },
};