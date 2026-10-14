/** En qué se mide la meta diaria: minutos de lectura o páginas leídas. */
export type GoalType = 'minutes' | 'pages';

/** Meta diaria de lectura: de qué tipo es y cuánto hay que alcanzar cada día. Se guarda en el perfil del usuario. */
export interface DailyGoal {
  type: GoalType;
  /** Minutos o páginas al día, según `type`. Los límites de cada tipo están en `utils/dailyGoal` y en firestore.rules. */
  target: number;
}
