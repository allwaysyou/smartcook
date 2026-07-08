/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IngredientSubstitute {
  name: string;
  ratio: string; // e.g. "1:1" or "1:0.7"
}

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  substitutes?: IngredientSubstitute[];
}

export interface RecipeStep {
  step_number: number;
  instruction: string;
  requires_timer: boolean;
  duration_seconds: number;
  video_loop_url?: string;
}

export interface Recipe {
  _id: string;
  title: string;
  slug: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  servings_base: number;
  total_time_minutes: number;
  cover_image: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  description?: string;
  rating?: number;
  reviews_count?: number;
  overlapScore?: number;
  matchedCount?: number;
  macros?: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  is_diabetic_friendly?: boolean;
  is_keto?: boolean;
  is_high_protein?: boolean;
}

export type Category = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Desserts' | 'Fast Food' | 'Beverages';

export interface TimerState {
  timeLeft: number;
  isRunning: boolean;
  isPaused: boolean;
  isFinished: boolean;
  totalDuration: number;
}
