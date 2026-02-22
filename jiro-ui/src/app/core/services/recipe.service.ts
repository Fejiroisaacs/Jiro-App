import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_image_url: string | null;
  base_ingredients: Ingredient[];
  instructions: string | null;
  tags: string[];
  nutrition: Nutrition | null;
  dietary_flags: DietaryFlags | null;
  created_at: string;
  updated_at: string;
  latest_rating?: number | null;
  trial_count?: number | null;
  last_cooked?: string | null;
}

export interface Nutrition {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

export interface DietaryFlags {
  vegan?: boolean;
  vegetarian?: boolean;
  gluten_free?: boolean;
  dairy_free?: boolean;
  nut_free?: boolean;
}

export interface Ingredient {
  item: string;
  amount: string;
}

export interface RecipeTrial {
  id: string;
  recipe_id: string;
  date_cooked: string;
  result_image_url: string | null;
  notes: string | null;
  modifications: Modification[];
  rating: number | null;
  created_at: string;
}

export interface Modification {
  item: string;
  change: string;
}

export interface RecipeWithTrials extends Recipe {
  trials: RecipeTrial[];
}

export interface CreateRecipeRequest {
  title: string;
  description?: string;
  target_image_url?: string;
  base_ingredients?: Ingredient[];
  instructions?: string;
  tags?: string[];
  nutrition?: Nutrition;
  dietary_flags?: DietaryFlags;
}

export interface UpdateRecipeRequest {
  title?: string;
  description?: string;
  target_image_url?: string;
  base_ingredients?: Ingredient[];
  instructions?: string;
  tags?: string[];
  nutrition?: Nutrition;
  dietary_flags?: DietaryFlags;
}

export interface CreateTrialRequest {
  date_cooked?: string;
  result_image_url?: string;
  notes?: string;
  modifications?: Modification[];
  rating?: number;
}

export interface UpdateTrialRequest {
  date_cooked?: string;
  notes?: string;
  modifications?: Modification[];
  rating?: number;
}

const API_URL = `${environment.apiUrl}/culinara`;

export interface CookStreak {
  current_streak: number;
  longest_streak: number;
  total_cook_days: number;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  recipe_count?: number;
}

@Injectable({ providedIn: 'root' })
export class RecipeService {
  constructor(private http: HttpClient) { }

  listRecipes(search?: string): Observable<Recipe[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('q', search);
    }
    return this.http.get<Recipe[]>(`${API_URL}/recipes`, { params });
  }

  getRecipe(id: string): Observable<RecipeWithTrials> {
    return this.http.get<RecipeWithTrials>(`${API_URL}/recipes/${id}`);
  }

  createRecipe(req: CreateRecipeRequest): Observable<Recipe> {
    return this.http.post<Recipe>(`${API_URL}/recipes`, req);
  }

  updateRecipe(id: string, req: UpdateRecipeRequest): Observable<Recipe> {
    return this.http.put<Recipe>(`${API_URL}/recipes/${id}`, req);
  }

  deleteRecipe(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/recipes/${id}`);
  }

  createTrial(recipeId: string, req: CreateTrialRequest): Observable<RecipeTrial> {
    return this.http.post<RecipeTrial>(`${API_URL}/recipes/${recipeId}/trials`, req);
  }

  updateTrial(trialId: string, req: UpdateTrialRequest): Observable<RecipeTrial> {
    return this.http.put<RecipeTrial>(`${API_URL}/trials/${trialId}`, req);
  }

  deleteTrial(trialId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/trials/${trialId}`);
  }

  promoteTrial(trialId: string): Observable<Recipe> {
    return this.http.post<Recipe>(`${API_URL}/promote/${trialId}`, {});
  }

  getCookStreak(): Observable<CookStreak> {
    return this.http.get<CookStreak>(`${API_URL}/cook-streak`);
  }

  // ─── Collections ──────────────────────────────────
  listCollections(): Observable<Collection[]> {
    return this.http.get<Collection[]>(`${API_URL}/collections`);
  }

  createCollection(name: string): Observable<Collection> {
    return this.http.post<Collection>(`${API_URL}/collections`, { name });
  }

  updateCollection(id: string, name: string): Observable<Collection> {
    return this.http.put<Collection>(`${API_URL}/collections/${id}`, { name });
  }

  deleteCollection(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/collections/${id}`);
  }

  addToCollection(collectionId: string, recipeId: string): Observable<any> {
    return this.http.post(`${API_URL}/collections/${collectionId}/recipes`, { recipe_id: recipeId });
  }

  removeFromCollection(collectionId: string, recipeId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/collections/${collectionId}/recipes/${recipeId}`);
  }

  getCollectionRecipeIds(collectionId: string): Observable<string[]> {
    return this.http.get<string[]>(`${API_URL}/collections/${collectionId}/recipe-ids`);
  }
}
