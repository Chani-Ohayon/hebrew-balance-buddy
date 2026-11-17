import { createFileRoute } from "@tanstack/react-router";
import { SignIn } from "@/components/sign-in";
export const Route = createFileRoute("/")({ head: () => ({ meta: [
  { title: "חישוב מהיר — החשבון הפרטי שלך" }, { name: "description", content: "כניסה לחשבון פרטי לניהול הוצאות וקבוצות אישיות." },
  { property: "og:title", content: "חישוב מהיר — החשבון הפרטי שלך" }, { property: "og:description", content: "ניהול הוצאות קבוצתיות בחשבון אישי." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: SignIn });