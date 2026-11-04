import * as Localization from 'expo-localization';

export type SupportedLanguage = 'en' | 'hi';

export interface Translations {
  // Navigation
  navDashboard: string;
  navWorkouts: string;
  navMealScan: string;
  navIngredientLab: string;
  navSettings: string;

  // Dashboard
  remaining: string;
  consumed: string;
  protein: string;
  carbs: string;
  fats: string;
  loggedMeals: string;
  noMealsYet: string;
  snapOrLogMeal: string;
  recentScans: string;
  offlineBanner: string;

  // Workouts
  workoutsTitle: string;
  startEmptyWorkout: string;
  routineTemplates: string;
  workoutHistory: string;
  noWorkoutsLogged: string;
  finishWorkout: string;
  discardWorkout: string;
  addExercise: string;
  addSet: string;
  setLabel: string;
  weightKg: string;
  repsLabel: string;
  doneLabel: string;
  restTimer: string;
  restComplete: string;
  weightPr: string;
  bestSetPr: string;

  // Ingredient Lab
  ingredientRiskScreening: string;
  safeAndClean: string;
  moderateRisk: string;
  highRisk: string;
  flaggedAdditives: string;
  ingredientsBreakdown: string;
  whyItsFlagged: string;
  regulatorySource: string;
  viewStandard: string;

  // Common
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  close: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, Translations> = {
  en: {
    navDashboard: 'Dashboard',
    navWorkouts: 'Workouts',
    navMealScan: 'Food Vision',
    navIngredientLab: 'Ingredient Lab',
    navSettings: 'Settings',

    remaining: 'Remaining',
    consumed: 'consumed',
    protein: 'Protein',
    carbs: 'Carbs',
    fats: 'Fats',
    loggedMeals: 'Logged Meals',
    noMealsYet: 'No meals logged today',
    snapOrLogMeal: 'Snap a plate photo or log ingredients to track calories and macros.',
    recentScans: 'Recent Scans',
    offlineBanner: 'Offline Mode • Local SQLite active',

    workoutsTitle: 'Workouts',
    startEmptyWorkout: 'Start Empty',
    routineTemplates: 'Routine Templates',
    workoutHistory: 'Workout History',
    noWorkoutsLogged: 'No workouts logged yet',
    finishWorkout: 'Finish Workout',
    discardWorkout: 'Discard Workout',
    addExercise: 'Add Exercise',
    addSet: 'Add Set',
    setLabel: 'SET',
    weightKg: 'WEIGHT (KG)',
    repsLabel: 'REPS',
    doneLabel: 'DONE',
    restTimer: 'REST TIMER',
    restComplete: 'REST COMPLETE!',
    weightPr: 'WEIGHT PR',
    bestSetPr: 'BEST SET',

    ingredientRiskScreening: 'Ingredient Risk Screening',
    safeAndClean: 'Safe & Clean',
    moderateRisk: 'Moderate Hazard',
    highRisk: 'High Risk',
    flaggedAdditives: 'Flagged Additives',
    ingredientsBreakdown: 'Ingredients Breakdown',
    whyItsFlagged: "Why it's flagged:",
    regulatorySource: 'Regulatory Source',
    viewStandard: 'View standard',

    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
  },
  hi: {
    navDashboard: 'डैशबोर्ड',
    navWorkouts: 'वर्कआउट',
    navMealScan: 'मील विज़न',
    navIngredientLab: 'इंग्रीडिएंट लैब',
    navSettings: 'सेटिंग्स',

    remaining: 'शेष कैलोरी',
    consumed: 'खपत',
    protein: 'प्रोटीन',
    carbs: 'कार्ब्स',
    fats: 'फैट्स',
    loggedMeals: 'आज का आहार',
    noMealsYet: 'आज कोई भोजन दर्ज नहीं किया गया',
    snapOrLogMeal: 'कैलोरी और मैक्रोज़ ट्रैक करने के लिए भोजन की तस्वीर लें या दर्ज करें।',
    recentScans: 'हाल के स्कैन',
    offlineBanner: 'ऑफ़लाइन मोड • लोकल SQLite सक्रिय',

    workoutsTitle: 'वर्कआउट',
    startEmptyWorkout: 'कस्टम शुरू करें',
    routineTemplates: 'रूटीन टेम्पलेट्स',
    workoutHistory: 'वर्कआउट इतिहास',
    noWorkoutsLogged: 'अभी तक कोई वर्कआउट दर्ज नहीं हुआ',
    finishWorkout: 'वर्कआउट समाप्त करें',
    discardWorkout: 'रद्द करें',
    addExercise: 'व्यायाम जोड़ें',
    addSet: 'सेट जोड़ें',
    setLabel: 'सेट',
    weightKg: 'वज़न (किग्रा)',
    repsLabel: 'रेप्स',
    doneLabel: 'पूर्ण',
    restTimer: 'विश्राम टाइमर',
    restComplete: 'विश्राम पूरा हुआ!',
    weightPr: 'वज़न रिकॉर्ड (PR)',
    bestSetPr: 'सर्वश्रेष्ठ सेट',

    ingredientRiskScreening: 'घटक जोखिम जांच',
    safeAndClean: 'सुरक्षित और स्वच्छ',
    moderateRisk: 'मध्यम जोखिम',
    highRisk: 'उच्च जोखिम',
    flaggedAdditives: 'चिह्नित एडिटिव्स',
    ingredientsBreakdown: 'सामग्री विवरण',
    whyItsFlagged: 'चेतावनी का कारण:',
    regulatorySource: 'मानक स्रोत',
    viewStandard: 'मानक देखें',

    save: 'सहेजें',
    cancel: 'रद्द करें',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    close: 'बंद करें',
  },
};

/**
 * Detects device language code (defaults to 'en').
 */
export function getDeviceLanguage(): SupportedLanguage {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const code = locales[0]?.languageCode;
      if (code === 'hi') return 'hi';
    }
  } catch {
    // fallback
  }
  return 'en';
}

let currentLanguage: SupportedLanguage = getDeviceLanguage();

export function setAppLanguage(lang: SupportedLanguage) {
  currentLanguage = lang;
}

export function getAppLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function t<K extends keyof Translations>(key: K): string {
  return TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || String(key);
}
