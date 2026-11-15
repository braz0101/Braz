import {
  Award, Baby, BookOpen, Briefcase, Bus, Car, Coffee, Coins, Dumbbell, Ellipsis, Fuel, Gamepad2, Gift,
  GraduationCap, HeartPulse, House, Laptop, Music, PawPrint, PiggyBank, Plane, Receipt, Shirt, ShoppingBag,
  Smartphone, Target, Utensils, Wallet, Wifi, type LucideIcon,
} from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, bus: Bus, home: House, graduation: GraduationCap, heart: HeartPulse, gamepad: Gamepad2,
  bag: ShoppingBag, receipt: Receipt, phone: Smartphone, briefcase: Briefcase, award: Award, laptop: Laptop,
  gift: Gift, coins: Coins, car: Car, plane: Plane, shirt: Shirt, coffee: Coffee, book: BookOpen, baby: Baby,
  paw: PawPrint, dumbbell: Dumbbell, music: Music, wifi: Wifi, fuel: Fuel, piggy: PiggyBank, target: Target,
  wallet: Wallet, more: Ellipsis,
}
export const ICON_KEYS = Object.keys(ICONS)
export const GOAL_ICONS = ['target', 'piggy', 'laptop', 'phone', 'home', 'car', 'plane', 'graduation', 'gift', 'heart', 'briefcase', 'wallet']
export const iconFor = (key: string): LucideIcon => ICONS[key] ?? Ellipsis
