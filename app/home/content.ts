export type {
  HomeCardIcon,
  HomeCardTone,
  HomeQuickAccessViewCard as HomeQuickAccessCard,
} from "@/src/features/home/homeQuickAccess";

export const HOME_HERO_CONTENT = {
  badge: "Karşılama Alanı",
  title: "İyi günler",
  description: "Sık kullandığınız modüllere buradan hızlıca ulaşabilirsiniz.",
  chips: ["Çalışanlar", "Planlama", "Puantaj", "Denetim"],
} as const;

export const HOME_QUICK_ACCESS_CONTENT = {
  title: "Hızlı erişim kartları",
  description: "Sık kullanılan modülleri doğrudan açın.",
} as const;
