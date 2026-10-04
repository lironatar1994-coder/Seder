export const PROJECT_TEMPLATES = [
  { id: 'blank', name: 'פרויקט ריק', sections: [] },
  { id: 'workflow', name: 'תהליך עבודה', sections: ['לביצוע', 'בביצוע', 'לבדיקה'] },
  { id: 'trip', name: 'תכנון טיול', sections: ['לפני היציאה', 'הזמנות וסידורים', 'במהלך הטיול'] },
  { id: 'launch', name: 'השקת מוצר', sections: ['תכנון', 'עיצוב ופיתוח', 'בדיקות', 'השקה'] },
  { id: 'study', name: 'למידה', sections: ['ללמוד', 'תרגול', 'חזרה'] },
] as const;
