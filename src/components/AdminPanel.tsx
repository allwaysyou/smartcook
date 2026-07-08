import React, { useState, useRef } from 'react';
import { Recipe, Ingredient, RecipeStep, Category } from '../types';
import { 
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, UploadCloud, 
  Check, Lock, FileSpreadsheet, Sparkles, AlertCircle, X, CheckCircle, RefreshCw 
} from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
  recipes: Recipe[];
  onRefresh: () => Promise<void>;
}

// Default units list
const UNITS = ['grams', 'cup', 'tsp', 'tbsp', 'pieces', 'ml', 'liters', 'pinch', 'inch', 'to taste'];

export default function AdminPanel({ onClose, recipes, onRefresh }: AdminPanelProps) {
  // Authentication State
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('smartcook_admin_auth') === 'admin123';
  });
  const [authError, setAuthError] = useState('');

  // Active form tab
  const [activeTab, setActiveTab] = useState<'create' | 'bulk' | 'manage'>('create');

  // Single Recipe Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('Breakfast');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [servingsBase, setServingsBase] = useState(2);
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(15);
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');

  // Ingredients Matrix State
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', quantity: 1, unit: 'grams', substitutes: [] }
  ]);

  // Steps Matrix State
  const [steps, setSteps] = useState<RecipeStep[]>([
    { step_number: 1, instruction: '', requires_timer: false, duration_seconds: 0 }
  ]);

  // Image compression stats
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: string;
    compressedSize: string;
    ratio: string;
  } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Bulk Upload State
  const [csvInput, setCsvInput] = useState('');
  const [parsedRecipes, setParsedRecipes] = useState<any[]>([]);
  const [bulkParseError, setBulkParseError] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkSuccessCount, setBulkSuccessCount] = useState<number | null>(null);

  // General Notification Banner
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Trigger temporary banners
  const showBanner = (type: 'success' | 'error', message: string) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 5000);
  };

  // 1. Password verification handler
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('smartcook_admin_auth', 'admin123');
        setAuthError('');
      } else {
        setAuthError(data.message || 'Invalid passcode.');
      }
    } catch (err) {
      setAuthError('Connection error to security server.');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('smartcook_admin_auth');
    setPassword('');
  };

  // 2. Client-side Image compression into optimized WebP formats on-the-fly
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showBanner('error', 'Please upload a valid image file.');
      return;
    }
    setIsCompressing(true);
    try {
      const compressed = await compressToWebP(file);
      setCoverImage(compressed.dataUrl);
      setCompressionStats({
        originalSize: (compressed.sizeBefore / 1024).toFixed(1) + ' KB',
        compressedSize: (compressed.sizeAfter / 1024).toFixed(1) + ' KB',
        ratio: Math.round((1 - compressed.sizeAfter / compressed.sizeBefore) * 100) + '%'
      });
      showBanner('success', 'Image compressed and optimized successfully into WebP!');
    } catch (err: any) {
      showBanner('error', 'Compression error: ' + err.message);
    } finally {
      setIsCompressing(false);
    }
  };

  const compressToWebP = (file: File): Promise<{ dataUrl: string; sizeBefore: number; sizeAfter: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800; // Optimal size for recipe list
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/webp', 0.82); // WebP format at 82% quality
            const sizeBefore = file.size;
            const sizeAfter = Math.round(dataUrl.length * 0.75); // Approximate base64 size
            resolve({ dataUrl, sizeBefore, sizeAfter });
          } else {
            reject(new Error('Could not instantiate canvas context'));
          }
        };
        img.onerror = () => reject(new Error('Failed to load image file'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const triggerFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleImageFile(file);
    };
    input.click();
  };

  // Drag & drop file event triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  // 3. Dynamic Ingredients Handlers
  const addIngredientRow = () => {
    setIngredients([...ingredients, { name: '', quantity: 1, unit: 'grams', substitutes: [] }]);
  };

  const removeIngredientRow = (idx: number) => {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const updateIngredientField = (idx: number, field: keyof Ingredient, value: any) => {
    const updated = [...ingredients];
    updated[idx] = { ...updated[idx], [field]: value };
    setIngredients(updated);
  };

  // Nested substitutes setup within Row Injector
  const toggleSubstituteRow = (idx: number) => {
    const updated = [...ingredients];
    const ing = updated[idx];
    if (ing.substitutes && ing.substitutes.length > 0) {
      ing.substitutes = [];
    } else {
      ing.substitutes = [{ name: '', ratio: '1:1' }];
    }
    setIngredients(updated);
  };

  const updateSubstituteField = (ingIdx: number, subIdx: number, field: 'name' | 'ratio', value: string) => {
    const updated = [...ingredients];
    const ing = updated[ingIdx];
    if (ing.substitutes && ing.substitutes[subIdx]) {
      ing.substitutes[subIdx] = { ...ing.substitutes[subIdx], [field]: value };
    }
    setIngredients(updated);
  };

  // 4. Drag-and-Drop / Interactive Sequence Step Generator
  const addStepRow = () => {
    setSteps([...steps, { 
      step_number: steps.length + 1, 
      instruction: '', 
      requires_timer: false, 
      duration_seconds: 0 
    }]);
  };

  const removeStepRow = (idx: number) => {
    if (steps.length === 1) return;
    const filtered = steps.filter((_, i) => i !== idx);
    // re-calculate step numbers auto-incremented
    const renumbered = filtered.map((step, i) => ({
      ...step,
      step_number: i + 1
    }));
    setSteps(renumbered);
  };

  const updateStepField = (idx: number, field: keyof RecipeStep, value: any) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setSteps(updated);
  };

  // HTML5 Drag and Drop for sequence order updates
  const dragIdxRef = useRef<number | null>(null);

  const handleStepDragStart = (idx: number) => {
    dragIdxRef.current = idx;
  };

  const handleStepDrop = (dropIdx: number) => {
    if (dragIdxRef.current === null || dragIdxRef.current === dropIdx) return;
    const dragIdx = dragIdxRef.current;
    
    const reordered = [...steps];
    const [draggedItem] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, draggedItem);

    // Renumber steps sequentially
    const renumbered = reordered.map((step, i) => ({
      ...step,
      step_number: i + 1
    }));
    setSteps(renumbered);
    dragIdxRef.current = null;
  };

  // Manual fallback order buttons (Up/Down)
  const moveStepOrder = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    
    const copy = [...steps];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;

    const renumbered = copy.map((step, i) => ({
      ...step,
      step_number: i + 1
    }));
    setSteps(renumbered);
  };

  // 5. Submit Single Recipe Form
  const handleCreateRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showBanner('error', 'Recipe title is required!');
      return;
    }

    const filteredIngredients = ingredients.filter(ing => ing.name.trim() !== '');
    if (filteredIngredients.length === 0) {
      showBanner('error', 'At least one valid ingredient with a name is required.');
      return;
    }

    const filteredSteps = steps.filter(step => step.instruction.trim() !== '');
    if (filteredSteps.length === 0) {
      showBanner('error', 'At least one valid cooking step is required.');
      return;
    }

    const payload = {
      title,
      category,
      difficulty,
      servings_base: servingsBase,
      total_time_minutes: totalTimeMinutes,
      cover_image: coverImage || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800',
      description,
      ingredients: filteredIngredients,
      steps: filteredSteps
    };

    try {
      const res = await fetch('/api/admin/recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showBanner('success', `Recipe "${title}" has been successfully indexed!`);
        // Reset single recipe form states
        setTitle('');
        setCoverImage('');
        setDescription('');
        setCompressionStats(null);
        setIngredients([{ name: '', quantity: 1, unit: 'grams', substitutes: [] }]);
        setSteps([{ step_number: 1, instruction: '', requires_timer: false, duration_seconds: 0 }]);
        await onRefresh();
      } else {
        showBanner('error', data.message || 'Failed to create recipe.');
      }
    } catch (err: any) {
      showBanner('error', 'Core database connectivity exception: ' + err.message);
    }
  };

  // 6. Advanced Bulk CSV Spreadsheet Parsing Engine
  const parseBulkCSV = () => {
    if (!csvInput.trim()) {
      setBulkParseError('Please enter raw CSV data or select a template.');
      return;
    }
    setBulkParseError('');
    setParsedRecipes([]);

    try {
      const lines = csvInput.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setBulkParseError('CSV must include at least a header row and one recipe row.');
        return;
      }

      // Simple CSV Splitter honoring quoted values
      const splitCsvRow = (text: string) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = splitCsvRow(lines[0]).map(h => h.toLowerCase());
      
      const titleIdx = headers.indexOf('title');
      const categoryIdx = headers.indexOf('category');
      const diffIdx = headers.indexOf('difficulty');
      const servingsIdx = headers.indexOf('servingsbase');
      const timeIdx = headers.indexOf('totaltimeminutes');
      const descIdx = headers.indexOf('description');
      const coverIdx = headers.indexOf('coverimage');
      const ingredientsIdx = headers.indexOf('ingredients');
      const stepsIdx = headers.indexOf('steps');

      if (titleIdx === -1 || categoryIdx === -1) {
        setBulkParseError('Header must include at least "Title" and "Category" columns.');
        return;
      }

      const results: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const columns = splitCsvRow(lines[i]);
        if (columns.length === 0 || !columns[titleIdx]) continue;

        // A. Parse ingredients in format: Name:Qty:Unit[Substitute:AltName, Ratio X:Y]
        // separated by ';' or ','
        const rawIngredients = ingredientsIdx !== -1 ? columns[ingredientsIdx] : '';
        const parsedIngredients: Ingredient[] = [];
        
        if (rawIngredients) {
          const items = rawIngredients.split(';').map(item => item.trim()).filter(Boolean);
          items.forEach(item => {
            // Check for substitute bracket: name:qty:unit[Substitute:Alt, Ratio 1:1]
            let subField = '';
            let mainField = item;
            
            const subMatch = item.match(/\[(.*?)\]/);
            if (subMatch) {
              subField = subMatch[1];
              mainField = item.replace(/\[.*?\]/, '').trim();
            }

            const parts = mainField.split(':').map(p => p.trim());
            const name = parts[0] || '';
            const quantity = Number(parts[1]) || 1;
            const unit = parts[2] || 'grams';

            const subsList = [];
            if (subField) {
              // Substitute:Jaggery, Ratio 1:1
              const subParts = subField.split(',').map(s => s.trim());
              const namePart = subParts.find(p => p.startsWith('Substitute:'))?.replace('Substitute:', '') || '';
              const ratioPart = subParts.find(p => p.startsWith('Ratio:'))?.replace('Ratio:', '') || '1:1';
              if (namePart) {
                subsList.push({ name: namePart, ratio: ratioPart });
              }
            }

            if (name) {
              parsedIngredients.push({ name, quantity, unit, substitutes: subsList });
            }
          });
        }

        // B. Parse sequential cooking steps:
        // separated by '|' or ';'
        // e.g. "Step text (Requires Timer: 120 seconds) | Next Step text"
        const rawSteps = stepsIdx !== -1 ? columns[stepsIdx] : '';
        const parsedSteps: RecipeStep[] = [];
        if (rawSteps) {
          const items = rawSteps.split('|').map(item => item.trim()).filter(Boolean);
          items.forEach((item, sIdx) => {
            let duration = 0;
            let requiresTimer = false;
            
            // extract Timer: e.g. (Requires Timer: 180 seconds) or (180s)
            const timerMatch = item.match(/\((Requires Timer:)?\s*(\d+)\s*(seconds|s)\)/i);
            let cleanedInstruction = item;
            if (timerMatch) {
              duration = Number(timerMatch[2]) || 0;
              requiresTimer = duration > 0;
              cleanedInstruction = item.replace(/\(.*?\)/, '').trim();
            }

            parsedSteps.push({
              step_number: sIdx + 1,
              instruction: cleanedInstruction,
              requires_timer: requiresTimer,
              duration_seconds: duration
            });
          });
        }

        // Calculate total preparation time dynamically if missing
        let totalTime = timeIdx !== -1 ? Number(columns[timeIdx]) : 0;
        if (!totalTime && parsedSteps.length > 0) {
          // sum timer durations into minutes rounded up
          const totalSeconds = parsedSteps.reduce((acc, curr) => acc + curr.duration_seconds, 0);
          totalTime = Math.ceil(totalSeconds / 60) + 10; // add 10 mins buffer for general prep
        }

        results.push({
          title: columns[titleIdx],
          category: (columns[categoryIdx] as Category) || 'Breakfast',
          difficulty: diffIdx !== -1 ? (columns[diffIdx] as any) : 'Easy',
          servings_base: servingsIdx !== -1 ? (Number(columns[servingsIdx]) || 2) : 2,
          total_time_minutes: totalTime || 15,
          description: descIdx !== -1 ? columns[descIdx] : '',
          cover_image: coverIdx !== -1 ? columns[coverIdx] : '',
          ingredients: parsedIngredients,
          steps: parsedSteps
        });
      }

      if (results.length === 0) {
        setBulkParseError('No recipes parsed. Check row formats.');
      } else {
        setParsedRecipes(results);
      }
    } catch (err: any) {
      setBulkParseError('Parsing system exception: ' + err.message);
    }
  };

  // Load a quick sample template to test parsing engine
  const loadTemplate = () => {
    const template = `Title,Category,Difficulty,ServingsBase,TotalTimeMinutes,Description,CoverImage,Ingredients,Steps
Adrak Elaichi Wali Chai,Beverages,Easy,2,8,Spiced ginger and cardamom Indian tea,https://images.unsplash.com/photo-1599487488170-d11ec9c172f0,Water:1:cup; Milk:1:cup; Tea Leaves:2:tsp; Sugar:2:tsp[Substitute:Jaggery (Gud), Ratio:1:1]; Crushed Ginger:1:inch,Heat sauce pan with water and ginger (Requires Timer: 120s) | Add tea leaves and sugar (Requires Timer: 180s) | Pour milk and simmer (Requires Timer: 180s) | Sieve and serve
Butter Roti Extra Crisp,Dinner,Easy,4,15,Crispy golden tandoori-style rotis,https://images.unsplash.com/photo-1505253716362-afaea1d3d1af,Whole Wheat Flour:2:cups; Butter:2:tbsp[Substitute:Ghee, Ratio:1:0.8]; Salt:0.5:tsp; Water:1:cup,Knead soft dough with salt and water (Requires Timer: 600s) | Roll into thin circles | Sauté on hot tawa applying butter (Requires Timer: 180s)`;
    setCsvInput(template);
    setBulkParseError('');
  };

  // Submit parsed bulk array to backend
  const handleBulkUploadSubmit = async () => {
    if (parsedRecipes.length === 0) return;
    setIsBulkSubmitting(true);
    try {
      const res = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({ recipes: parsedRecipes })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBulkSuccessCount(data.count);
        setParsedRecipes([]);
        setCsvInput('');
        await onRefresh();
        showBanner('success', `${data.count} recipes indexed in bulk into clusters!`);
      } else {
        showBanner('error', data.message || 'Failed to inject recipes.');
      }
    } catch (err: any) {
      showBanner('error', 'Bulk injection exception: ' + err.message);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // 7. Delete Recipe handler (Manage recipes tab)
  const handleDeleteRecipe = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete the recipe "${title}"? This is irreversible.`)) return;
    try {
      const res = await fetch(`/api/admin/recipes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showBanner('success', `Recipe "${title}" removed successfully.`);
        await onRefresh();
      } else {
        showBanner('error', data.message || 'Failed to delete recipe.');
      }
    } catch (err: any) {
      showBanner('error', 'Connection error during recipe deletion.');
    }
  };

  // Lock overlay for authentication
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 bg-[#FDFCFB] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 max-w-md w-full shadow-2xl flex flex-col items-center space-y-6">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500 animate-pulse">
            <Lock className="w-8 h-8" />
          </div>
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Admin Gatekeeper</h2>
            <p className="text-xs text-gray-500">Enter security passcode to unlock SmartCook databases.</p>
          </div>

          <form onSubmit={handleVerify} className="w-full space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Passcode Key</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-center text-gray-900 font-extrabold"
                autoFocus
              />
              <span className="text-[10px] text-gray-400 block mt-1 text-center">Hint: The default dev passcode is <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-orange-600">admin123</code></span>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{authError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-orange-500/10 cursor-pointer"
              >
                Authenticate
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-col font-sans">
      {/* Dynamic Notifications */}
      {banner && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 border animate-in slide-in-from-top-4 duration-200 max-w-md ${
          banner.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          {banner.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
          <span className="text-xs font-bold leading-normal">{banner.message}</span>
          <button onClick={() => setBanner(null)} className="ml-auto text-gray-400 hover:text-gray-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Panel Header */}
      <nav className="h-16 px-4 md:px-8 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-50 rounded-full text-gray-600 hover:text-orange-500 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-gray-900 flex items-center gap-2">
              <span>Database Portal</span>
              <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Admin</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-medium">Seed and scale recipes with live database persistent clusters.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 border border-red-200 text-red-600 bg-red-50/50 hover:bg-red-50 rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
          >
            Lock Terminal
          </button>
        </div>
      </nav>

      {/* Tab Selectors */}
      <div className="bg-white border-b border-gray-100 py-3 px-4 md:px-8 flex items-center justify-between shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('create'); setBulkSuccessCount(null); }}
            className={`px-4 py-2 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
              activeTab === 'create' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/15' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Add New Recipe Form
          </button>
          <button
            onClick={() => { setActiveTab('bulk'); setBulkSuccessCount(null); }}
            className={`px-4 py-2 text-xs font-extrabold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bulk' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/15' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Bulk CSV/Excel Data Engine</span>
          </button>
          <button
            onClick={() => { setActiveTab('manage'); setBulkSuccessCount(null); }}
            className={`px-4 py-2 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
              activeTab === 'manage' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/15' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Manage Recipe Database ({recipes.length})
          </button>
        </div>

        <span className="text-[11px] text-emerald-600 font-black flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>SYSTEM ONLINE (JSON Clusters Connected)</span>
        </span>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">

        {/* Tab 1: Single Recipe Creation Form */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateRecipeSubmit} className="space-y-8 animate-in fade-in duration-200">
            
            {/* Section A: Core Metadata Segment */}
            <div className="bg-white p-6 md:p-8 border border-gray-100 rounded-[32px] shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center text-lg font-black">1</div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 tracking-tight">Core Metadata Segment</h2>
                  <p className="text-xs text-gray-500">Provide naming parameters, media coverages, and categorization values.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Recipe Title</label>
                  <input 
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Special Chicken Curry"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-gray-900 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Category)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-gray-900 font-semibold"
                    >
                      <option value="Breakfast">Breakfast</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Desserts">Desserts</option>
                      <option value="Fast Food">Fast Food</option>
                      <option value="Beverages">Beverages</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-gray-900 font-semibold"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Preparation Time (minutes)</label>
                    <input 
                      type="number"
                      required
                      min={1}
                      value={totalTimeMinutes}
                      onChange={(e) => setTotalTimeMinutes(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-gray-900 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Servings Base (people)</label>
                    <input 
                      type="number"
                      required
                      min={1}
                      value={servingsBase}
                      onChange={(e) => setServingsBase(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-gray-900 font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Recipe Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe the culinary masterpiece..."
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-gray-900 font-semibold resize-none"
                  />
                </div>
              </div>

              {/* Dynamic Drag and Drop Media Upload with on-the-fly compression */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Drag-and-Drop Image Optimizer (WebP)</label>
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={triggerFileSelect}
                    className="border-2 border-dashed border-gray-200 hover:border-orange-400 bg-gray-50 hover:bg-orange-50/10 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
                  >
                    <div className="w-12 h-12 bg-white group-hover:bg-orange-50 rounded-full flex items-center justify-center text-gray-400 group-hover:text-orange-500 transition-colors shadow-sm">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    {isCompressing ? (
                      <span className="text-xs text-orange-600 font-black animate-pulse">OPTIMIZING & COMPRESSING TO WEBP...</span>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-xs font-extrabold text-gray-700 block">Drag & Drop Image or Click to Sift</span>
                        <span className="text-[10px] text-gray-400 block font-medium">Auto-scaling, auto-conversion to optimized WebP.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Image Preview & WebP Specs</span>
                    {coverImage ? (
                      <div className="flex items-center gap-4">
                        <img 
                          src={coverImage} 
                          alt="Cover upload optimized preview" 
                          className="w-16 h-16 rounded-xl object-cover border border-gray-200 bg-white"
                          referrerPolicy="no-referrer"
                        />
                        {compressionStats && (
                          <div className="space-y-1 text-xs">
                            <div className="text-gray-500">Original Size: <strong className="text-gray-900 font-extrabold">{compressionStats.originalSize}</strong></div>
                            <div className="text-orange-700 font-bold bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-md max-w-max">
                              Optimized WebP: {compressionStats.compressedSize} (-{compressionStats.ratio})
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium block italic">No image optimized. Standard default placeholder will apply.</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Fallback Image URL</label>
                    <input 
                      type="text"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="Paste alternative direct Unsplash URL..."
                      className="w-full bg-white border border-gray-200 rounded-xl py-1.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-gray-900 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section B: Dynamic Ingredients Array Matrix */}
            <div className="bg-white p-6 md:p-8 border border-gray-100 rounded-[32px] shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center text-lg font-black">2</div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Dynamic Ingredients Array Matrix</h2>
                    <p className="text-xs text-gray-500">Add scalable ingredients with custom quantity metrics and nested substitute alternatives.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addIngredientRow}
                  className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Ingredient</span>
                </button>
              </div>

              <div className="space-y-4">
                {ingredients.map((ing, iIdx) => (
                  <div key={iIdx} className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 space-y-3 relative">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      
                      <div className="md:col-span-5 space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Ingredient Name</label>
                        <input 
                          type="text"
                          required
                          value={ing.name}
                          onChange={(e) => updateIngredientField(iIdx, 'name', e.target.value)}
                          placeholder="e.g. Kashmiri Red Chili Powder"
                          className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none text-gray-900 font-semibold"
                        />
                      </div>

                      <div className="md:col-span-3 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Quantity</label>
                          <input 
                            type="number"
                            required
                            step="any"
                            min={0}
                            value={ing.quantity || ''}
                            onChange={(e) => updateIngredientField(iIdx, 'quantity', parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 1.5"
                            className="w-full bg-white border border-gray-200 rounded-xl py-2 px-2 text-xs focus:outline-none text-gray-900 font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Unit</label>
                          <select
                            value={ing.unit}
                            onChange={(e) => updateIngredientField(iIdx, 'unit', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl py-2 px-1 text-xs focus:outline-none text-gray-900 font-semibold"
                          >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="md:col-span-4 flex items-center gap-2 pt-2 md:pt-0">
                        <button
                          type="button"
                          onClick={() => toggleSubstituteRow(iIdx)}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
                            ing.substitutes && ing.substitutes.length > 0
                              ? 'bg-amber-50 border-amber-200 text-amber-700 font-black'
                              : 'bg-white border-gray-200 hover:border-orange-200 text-gray-600 hover:text-orange-600'
                          }`}
                        >
                          🔄 {ing.substitutes && ing.substitutes.length > 0 ? 'Remove Alternative' : 'Add Substitute'}
                        </button>

                        {ingredients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeIngredientRow(iIdx)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all cursor-pointer"
                            title="Delete Ingredient Row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Nested Substitute Block Row Injector */}
                    {ing.substitutes && ing.substitutes.length > 0 && (
                      <div className="mt-2 pl-4 border-l-2 border-amber-300 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/20 p-3 rounded-r-xl">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-amber-800 tracking-wider">Alternative Ingredient Name</label>
                          <input 
                            type="text"
                            required
                            value={ing.substitutes[0].name}
                            onChange={(e) => updateSubstituteField(iIdx, 0, 'name', e.target.value)}
                            placeholder="e.g. Jaggery (Gud) / Brown Sugar"
                            className="w-full bg-white border border-amber-200 rounded-xl py-1.5 px-3 text-xs focus:outline-none text-gray-900 font-semibold focus:border-amber-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-amber-800 tracking-wider">Conversion Ratio (Original:Alternative)</label>
                          <input 
                            type="text"
                            required
                            value={ing.substitutes[0].ratio}
                            onChange={(e) => updateSubstituteField(iIdx, 0, 'ratio', e.target.value)}
                            placeholder="e.g. 1:1 or 1:0.8"
                            className="w-full bg-white border border-amber-200 rounded-xl py-1.5 px-3 text-xs focus:outline-none text-gray-900 font-semibold focus:border-amber-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section C: Drag-and-Drop Cooking Sequence Generator */}
            <div className="bg-white p-6 md:p-8 border border-gray-100 rounded-[32px] shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center text-lg font-black">3</div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Drag-and-Drop Cooking Sequence Generator</h2>
                    <p className="text-xs text-gray-500">Design step sequences. Drag and drop steps to reorder, and configure timer durations.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addStepRow}
                  className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Step</span>
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    draggable
                    onDragStart={() => handleStepDragStart(sIdx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleStepDrop(sIdx)}
                    className="bg-gray-50/50 hover:bg-orange-50/5 border border-gray-100 hover:border-orange-100 rounded-2xl p-4 flex gap-4 transition-all relative cursor-move"
                    title="Drag and Drop step to re-order sequence"
                  >
                    {/* Drag Handle & Step Label Indicator */}
                    <div className="flex flex-col items-center justify-center gap-1.5 shrink-0">
                      <div className="flex flex-col text-gray-300 hover:text-gray-500 select-none">
                        <span className="text-xs leading-none">▲</span>
                        <span className="text-xs leading-none">▼</span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">
                        {step.step_number}
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                        
                        <div className="md:col-span-8 space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Instructions (supports English/Hindi strings)</label>
                          <textarea
                            required
                            value={step.instruction}
                            onChange={(e) => updateStepField(sIdx, 'instruction', e.target.value)}
                            placeholder="Detail step instructions... e.g. कढ़ाई में तेल गर्म करें (Heat oil in a pan)..."
                            rows={2}
                            className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none text-gray-900 font-semibold resize-none"
                          />
                        </div>

                        <div className="md:col-span-4 space-y-3 bg-white border border-gray-100 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-gray-700">Requires Timer?</span>
                            <input 
                              type="checkbox"
                              checked={step.requires_timer}
                              onChange={(e) => {
                                updateStepField(sIdx, 'requires_timer', e.target.checked);
                                if (!e.target.checked) updateStepField(sIdx, 'duration_seconds', 0);
                              }}
                              className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                            />
                          </div>

                          {step.requires_timer && (
                            <div className="space-y-1 animate-in slide-in-from-top-2 duration-150">
                              <label className="text-[8px] font-black uppercase text-orange-600 tracking-wider block">Duration (seconds)</label>
                              <input 
                                type="number"
                                required
                                min={5}
                                value={step.duration_seconds || ''}
                                onChange={(e) => updateStepField(sIdx, 'duration_seconds', Number(e.target.value) || 0)}
                                placeholder="e.g. 180 seconds (3 mins)"
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1 px-2 text-xs focus:outline-none text-gray-900 font-mono font-bold"
                              />
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* Control buttons & deletions */}
                    <div className="flex flex-col justify-between items-end gap-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={sIdx === 0}
                          onClick={() => moveStepOrder(sIdx, 'up')}
                          className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-20 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={sIdx === steps.length - 1}
                          onClick={() => moveStepOrder(sIdx, 'down')}
                          className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-20 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStepRow(sIdx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Submission triggers */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-black uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
              >
                Exit Portal
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-orange-500/20 cursor-pointer"
              >
                Save Recipe to Database
              </button>
            </div>

          </form>
        )}


        {/* Tab 2: Advanced Bulk CSV/Excel Data Engine */}
        {activeTab === 'bulk' && (
          <div className="bg-white p-6 md:p-8 border border-gray-100 rounded-[32px] shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center text-lg shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">Advanced Bulk CSV/Excel Data Engine</h2>
                  <p className="text-xs text-gray-500">Index hundreds of recipes in batches without manual typing.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadTemplate}
                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
              >
                Load Sample Template
              </button>
            </div>

            {/* Formatting Guidelines help accordion */}
            <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-extrabold text-orange-900 block flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
                <span>Spreadsheet Column Formats Checklist</span>
              </span>
              <ul className="text-[11px] text-orange-800 space-y-1.5 pl-4 list-disc">
                <li>Headers must match: <code className="font-mono bg-orange-100/50 px-1 py-0.5 rounded">Title, Category, Difficulty, ServingsBase, TotalTimeMinutes, Description, CoverImage, Ingredients, Steps</code></li>
                <li><strong>Ingredients column separator:</strong> Use semicolons (<code className="font-mono bg-orange-100/50">;</code>) between items. Item format: <code className="font-mono bg-orange-100/50">IngredientName:Quantity:Unit[Substitute:AltName, Ratio:AltRatio]</code></li>
                <li><strong>Steps column separator:</strong> Use pipes (<code className="font-mono bg-orange-100/50">|</code>) between steps. Specify timers using parentheses: <code className="font-mono bg-orange-100/50">(Requires Timer: 120s)</code></li>
              </ul>
            </div>

            {/* Input csv text area */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Paste Spreadsheet Values (CSV/TSV Stream)</label>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="Title,Category,Difficulty,ServingsBase..."
                rows={8}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-mono focus:outline-none text-gray-900"
              />
            </div>

            {bulkParseError && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{bulkParseError}</span>
              </div>
            )}

            {bulkSuccessCount !== null && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-2xl flex flex-col gap-1.5 animate-in zoom-in duration-200">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Success! Batch Operation Completed!</span>
                </div>
                <p className="text-[11px] text-emerald-700 pl-7 font-medium">Successfully indexed <strong>{bulkSuccessCount}</strong> recipes into secure MongoDB JSON database clusters!</p>
              </div>
            )}

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={parseBulkCSV}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Analyze and Parse CSV Stream
              </button>

              {parsedRecipes.length > 0 && (
                <button
                  type="button"
                  disabled={isBulkSubmitting}
                  onClick={handleBulkUploadSubmit}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-orange-500/10 cursor-pointer flex items-center gap-1.5"
                >
                  {isBulkSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Execute Bulk Database Injection ({parsedRecipes.length} Rows)</span>
                </button>
              )}
            </div>

            {/* Parsed recipes grid preview */}
            {parsedRecipes.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-100 animate-in fade-in duration-150">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Parsed Stream Audit Log Preview</span>
                <div className="border border-gray-100 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 font-extrabold text-gray-500">
                        <th className="p-3">Title</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Difficulty</th>
                        <th className="p-3">Servings & Prep</th>
                        <th className="p-3">Ingredients</th>
                        <th className="p-3">Steps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedRecipes.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 font-medium">
                          <td className="p-3 font-extrabold text-gray-950">{item.title}</td>
                          <td className="p-3 text-orange-600 font-bold">{item.category}</td>
                          <td className="p-3"><span className="bg-gray-100 px-2 py-0.5 rounded-full font-bold">{item.difficulty}</span></td>
                          <td className="p-3 text-gray-500">{item.servings_base} servings / {item.total_time_minutes} mins</td>
                          <td className="p-3 text-gray-500">
                            {item.ingredients.length} items
                            <span className="block text-[10px] text-gray-400 truncate max-w-xs">{item.ingredients.map((ing: any) => ing.name).join(', ')}</span>
                          </td>
                          <td className="p-3 text-gray-500">
                            {item.steps.length} steps
                            <span className="block text-[10px] text-gray-400 truncate max-w-xs">{item.steps.map((st: any) => st.instruction).join(' | ')}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Tab 3: Database Manager (List and Delete) */}
        {activeTab === 'manage' && (
          <div className="bg-white p-6 md:p-8 border border-gray-100 rounded-[32px] shadow-sm space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Manage Recipe Database</h2>
              <p className="text-xs text-gray-500">View current entries inside memory clusters and drop index fields.</p>
            </div>

            <div className="divide-y divide-gray-100">
              {recipes.map((rec) => (
                <div key={rec._id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={rec.cover_image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800'} 
                      alt={rec.title} 
                      className="w-12 h-12 rounded-xl object-cover bg-gray-100 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h3 className="font-extrabold text-sm text-gray-900">{rec.title}</h3>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1 font-bold">
                        <span className="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">{rec.category}</span>
                        <span>•</span>
                        <span>{rec.difficulty}</span>
                        <span>•</span>
                        <span>{rec.ingredients.length} Ingredients</span>
                        <span>•</span>
                        <span>{rec.steps.length} Steps</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteRecipe(rec._id, rec.title)}
                    className="px-3 py-1.5 border border-red-100 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Delete Recipe
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
