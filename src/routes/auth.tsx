import { createFileRoute } from "@tanstack/react-router";
import { SignIn } from "@/components/sign-in";
export const Route = createFileRoute("/auth")({ head: () => ({ meta: [
  { title: "כניסה והרשמה — חישוב מהיר" }, { name: "description", content: "כניסה או יצירת חשבון לניהול הקבוצות הפרטיות שלך." },
  { property: "og:title", content: "כניסה והרשמה — חישוב מהיר" }, { property: "og:description", content: "התחברות לחשבון אישי של חישוב מהיר." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: SignIn });