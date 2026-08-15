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
    conversations: "Conversations",
    online: "En ligne",
    placeholder: "Posez votre question sur l'ITIE…",
    aiDisclaimer:
      "Assistant IA — l'exactitude des réponses dépend de la qualité de la question. MREITI BOT peut se tromper, vérifiez les informations importantes.",
    error: "Impossible de joindre le serveur. Vérifiez votre connexion.",
    retry: "Réessayer",
    thinking: "MREITI BOT est en train de réfléchir",
    thinkingStages: [
      "MREITI BOT est en train de réfléchir",
      "Recherche dans les rapports ITIE…",
      "Analyse des extraits pertinents…",
      "Rédaction de la réponse…",
    ],
    botName: "MREITI BOT",
    subtitle: "MREITI · ITIE Mauritanie",
    installApp: "Installer l'application",
    installIosTitle: "Installer sur iPhone/iPad",
    installIosStep1: "Appuyez sur le bouton Partager",
    installIosStep2: "puis sur « Sur l'écran d'accueil »",
    installClose: "Fermer",
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
    conversations: "المحادثات",
    online: "متصل",
    placeholder: "اطرح سؤالك حول ITIE…",
    aiDisclaimer:
      "مساعد ذكاء اصطناعي — تعتمد دقة الإجابات على جودة السؤال. قد يخطئ MREITI BOT، يرجى التحقق من المعلومات المهمة.",
    error: "تعذّر الاتصال بالخادم. تحقق من اتصالك.",
    retry: "إعادة المحاولة",
    thinking: "MREITI BOT يفكّر…",
    thinkingStages: [
      "MREITI BOT يفكّر…",
      "البحث في تقارير ITIE…",
      "تحليل المقتطفات ذات الصلة…",
      "صياغة الرد…",
    ],
    botName: "MREITI BOT",
    subtitle: "MREITI · ITIE موريتانيا",
    installApp: "تثبيت التطبيق",
    installIosTitle: "التثبيت على iPhone/iPad",
    installIosStep1: "اضغط على زر المشاركة",
    installIosStep2: "ثم على «إضافة إلى الشاشة الرئيسية»",
    installClose: "إغلاق",
  },
} as const;

export function t(lang: Lang) {
  return translations[lang];
}

/** Remplace le premier segment ("/fr" ou "/ar") d'un chemin par la langue cible. */
export function swapLangInPath(pathname: string, target: Lang): string {
  const segments = pathname.split("/");
  if (segments[1] === "fr" || segments[1] === "ar") {
    segments[1] = target;
    return segments.join("/") || `/${target}`;
  }
  return `/${target}`;
}
