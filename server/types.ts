export type GenderOption = 'Male' | 'Female' | 'Non-binary' | 'All Genders';

export interface Question {
  id: number;
  text: string;
  category: string;
  applicableFor: GenderOption[];
  order: number;
}
