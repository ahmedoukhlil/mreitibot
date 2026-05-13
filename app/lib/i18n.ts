export type Lang = "fr" | "ar";

export const translations = {
  fr: {
    welcomeTitle: "Comment puis-je vous",
    welcomeTitleSpan: "aider ?",
    welcomeDesc:
      "Assistant expert en mise en œuvre de la Norme ITIE 2023 et en transparence des industries extractives en Mauritanie.",
    suggestions: [
      "Comment mettre en œuvre l'exigence 1.1 sur l'engagement du gouvernement ?",
      "Quelles sont les obligations des entreprises extractives selon l'exigence 1.2 ?",
      "Comment divulguer les bénéficiaires effectifs (exigence 2.5) ?",
      "Quelles étapes pour satisfaire l'exigence 4.1 sur la déclaration exhaustive ?",
    ],
    newChat: "Nouvelle conversation",
    suggestedQuestions: "Questions suggérées",
    online: "En ligne",
    placeholder: "Posez votre question sur l'ITIE…",
    hint: "pour envoyer",
    hintNewLine: "pour nouvelle ligne",
    error: "Impossible de joindre le serveur. Vérifiez votre connexion.",
    botName: "MREITI BOT",
    subtitle: "MREITI · ITIE Mauritanie",
  },
  ar: {
    welcomeTitle: "كيف يمكنني",
    welcomeTitleSpan: "مساعدتك ؟",
    welcomeDesc:
      "مساعد خبير في تطبيق معيار ITIE 2023 والشفافية في صناعات الاستخراج في موريتانيا.",
    suggestions: [
      "كيف يتم تطبيق المتطلب 1.1 بشأن التزام الحكومة؟",
      "ما هي التزامات الشركات الاستخراجية وفق المتطلب 1.2؟",
      "كيف يتم الإفصاح عن المستفيدين الفعليين (المتطلب 2.5)؟",
      "ما خطوات استيفاء المتطلب 4.1 حول الإعلان الشامل؟",
    ],
    newChat: "محادثة جديدة",
    suggestedQuestions: "أسئلة مقترحة",
    online: "متصل",
    placeholder: "اطرح سؤالك حول ITIE…",
    hint: "للإرسال",
    hintNewLine: "لسطر جديد",
    error: "تعذّر الاتصال بالخادم. تحقق من اتصالك.",
    botName: "MREITI BOT",
    subtitle: "MREITI · ITIE موريتانيا",
  },
} as const;

export function t(lang: Lang) {
  return translations[lang];
}
