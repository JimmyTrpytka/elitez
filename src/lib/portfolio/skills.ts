/** Co creator tvoří (stejné hodnoty hlídá databáze). */
export const CREATOR_SKILLS = ["photo", "video", "drone"] as const;
export type CreatorSkill = (typeof CREATOR_SKILLS)[number];
