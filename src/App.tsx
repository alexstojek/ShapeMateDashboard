// App.tsx
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Clock,
  Droplets,
  Dumbbell,
  FootprintsIcon,
  Moon,
  Sun,
  UtensilsCrossed
} from 'lucide-react';

/**
 * Erzeugt ein Array von Tagen, z. B. 5 Tage:
 * - 2 Tage vor heute
 * - heute (isToday = true)
 * - 2 Tage nach heute
 */
function getDynamicDates(daysBefore = 2, daysAfter = 2) {
  const monthNames = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];
  const today = new Date();
  const datesArray = [];

  for (let i = -daysBefore; i <= daysAfter; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const dayString = String(d.getDate()).padStart(2, '0');
    const monthString = monthNames[d.getMonth()];
    const isToday = i === 0;

    datesArray.push({
      day: dayString,
      month: monthString,
      isToday
    });
  }
  return datesArray;
}

// Mahlzeiten-Typ
interface Meal {
  id?: number;
  time: string;
  meal_title: string;
  kcal: number;
  protein?: string | number;
  carbs?: string | number;
  fat?: string | number;
  created_at?: string;
}

function App() {
  // Dark Mode als Standard
  const [darkMode, setDarkMode] = useState(true);

  // Dynamische Datumsauswahl (5 Tage)
  const [dates] = useState(() => getDynamicDates(2, 2));
  const [selectedDate, setSelectedDate] = useState(2); // Index 2 => heute

  // Login/Eingabe: Mobilnummer
  const [mobileNumberInput, setMobileNumberInput] = useState('');
  const [sender, setSender] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Stammdaten
  const [name, setName] = useState('');
  const [groesse, setGroesse] = useState<number>(0);
  const [kcalBedarf, setKcalBedarf] = useState<number>(0);

  // Gewicht (neuester Eintrag)
  const [weight, setWeight] = useState<number>(0);

  // Tages-Kalorien (aus mahlzeiten)
  const [kcalEaten, setKcalEaten] = useState<number>(0);

  // Makro-Bedarf (aus stammdaten)
  const [proteinMain, setProteinMain] = useState<number>(0);
  const [carbsMain, setCarbsMain] = useState<number>(0);
  const [fatMain, setFatMain] = useState<number>(0);

  // Konsumierte Makros (aus mahlzeiten)
  const [proteinConsumed, setProteinConsumed] = useState<number>(0);
  const [carbsConsumed, setCarbsConsumed] = useState<number>(0);
  const [fatConsumed, setFatConsumed] = useState<number>(0);

  // Tageswerte
  const [hydration, setHydration] = useState<number>(0);
  const [kcalWorkout, setKcalWorkout] = useState<number>(0);
  const [sleep, setSleep] = useState<string>('0');
  const [steps, setSteps] = useState<number>(0);

  // Mahlzeiten (Timeline)
  const [meals, setMeals] = useState<Meal[]>([]);

  /**
   * 1) NEU: Telefonnummer aus URL-Parametern lesen
   *    Beim Seitenladen wird geprüft, ob "?phone=xxx" vorhanden ist.
   *    Falls ja, wird 'sender' automatisch gesetzt.
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const phoneParam = urlParams.get('phone');
    if (phoneParam) {
      setSender(phoneParam.trim());
      setMobileNumberInput(phoneParam.trim());
    }
  }, []);

  /**
   * 2) Daten laden (tagesbezogen), sobald 'sender' bekannt ist
   */
  useEffect(() => {
    if (!sender) return;

    const dateObj = dates[selectedDate];
    if (!dateObj) return;

    const monthMap: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const currentYear = new Date().getFullYear();
    const dayNum = parseInt(dateObj.day, 10);
    const monthIndex = monthMap[dateObj.month] || 0;

    const startOfDay = new Date(currentYear, monthIndex, dayNum, 0, 0, 0);
    const endOfDay = new Date(currentYear, monthIndex, dayNum + 1, 0, 0, 0);
    const startOfDayISO = startOfDay.toISOString();
    const endOfDayISO = endOfDay.toISOString();

    const fetchData = async () => {
      try {
        // 1) Stammdaten
        const { data: stammdatenData } = await supabase
          .from('stammdaten')
          .select(
            'sender, name, groesse, kcal_bedarf, protein_main, carbs_main, fat_main'
          )
          .eq('sender', sender)
          .single();

        if (!stammdatenData) {
          setErrorMessage('Kein User mit dieser Nummer gefunden.');
          return;
        }
        setName(stammdatenData.name);
        setGroesse(stammdatenData.groesse);
        setKcalBedarf(stammdatenData.kcal_bedarf);
        setProteinMain(parseFloat(stammdatenData.protein_main || '0'));
        setCarbsMain(parseFloat(stammdatenData.carbs_main || '0'));
        setFatMain(parseFloat(stammdatenData.fat_main || '0'));

        // 2) user_weights -> neuester Eintrag
        const { data: weightData } = await supabase
          .from('user_weights')
          .select('weight, created_at')
          .eq('sender', sender)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (weightData) {
          setWeight(weightData.weight);
        }

        // 3) mahlzeiten (Tag)
        const { data: mealsData } = await supabase
          .from('mahlzeiten')
          .select('id, time, meal_title, kcal, protein, carbs, fat, created_at')
          .eq('sender', sender)
          .gte('created_at', startOfDayISO)
          .lt('created_at', endOfDayISO);

        if (mealsData && Array.isArray(mealsData)) {
          setMeals(mealsData);

          let sumKcal = 0;
          let sumProtein = 0;
          let sumCarbs = 0;
          let sumFat = 0;

          mealsData.forEach((m) => {
            sumKcal += m.kcal || 0;
            sumProtein += parseFloat((m.protein as string) || '0');
            sumCarbs += parseFloat((m.carbs as string) || '0');
            sumFat += parseFloat((m.fat as string) || '0');
          });

          setKcalEaten(sumKcal);
          setProteinConsumed(sumProtein);
          setCarbsConsumed(sumCarbs);
          setFatConsumed(sumFat);
        } else {
          setMeals([]);
          setKcalEaten(0);
          setProteinConsumed(0);
          setCarbsConsumed(0);
          setFatConsumed(0);
        }

        // 4) hydration_table (Tag)
        const { data: hydrationData } = await supabase
          .from('hydration_table')
          .select('hydration, created_at')
          .eq('sender', sender)
          .gte('created_at', startOfDayISO)
          .lt('created_at', endOfDayISO);

        if (hydrationData && Array.isArray(hydrationData)) {
          const totalH = hydrationData.reduce(
            (acc, row) => acc + parseFloat(row.hydration || '0'),
            0
          );
          setHydration(totalH);
        } else {
          setHydration(0);
        }

        // 5) kcal (Workouts)
        const { data: kcalRows } = await supabase
          .from('kcal')
          .select('kcal_verbrauch, created_at')
          .eq('sender', sender)
          .gte('created_at', startOfDayISO)
          .lt('created_at', endOfDayISO);

        if (kcalRows && Array.isArray(kcalRows)) {
          let totalW = 0;
          kcalRows.forEach((row) => {
            totalW += row.kcal_verbrauch || 0;
          });
          setKcalWorkout(totalW);
        } else {
          setKcalWorkout(0);
        }

        // 6) sleep_table (Tag)
        const { data: sleepRows } = await supabase
          .from('sleep_table')
          .select('sleep, created_at')
          .eq('sender', sender)
          .gte('created_at', startOfDayISO)
          .lt('created_at', endOfDayISO);

        if (sleepRows && Array.isArray(sleepRows)) {
          const totalSleep = sleepRows.reduce(
            (acc, row) => acc + parseFloat(row.sleep || '0'),
            0
          );
          setSleep(totalSleep.toFixed(2));
        } else {
          setSleep('0');
        }

        // 7) steps_table (Tag)
        const { data: stepsRows } = await supabase
          .from('steps_table')
          .select('steps, created_at')
          .eq('sender', sender)
          .gte('created_at', startOfDayISO)
          .lt('created_at', endOfDayISO);

        if (stepsRows && Array.isArray(stepsRows)) {
          const totalSteps = stepsRows.reduce(
            (acc, row) => acc + (row.steps || 0),
            0
          );
          setSteps(totalSteps);
        } else {
          setSteps(0);
        }
      } catch (err) {
        console.error('Fehler beim Laden:', err);
      }
    };

    fetchData();
  }, [sender, selectedDate, dates]);

  /**
   * 3) Eingabe-Feld für die Nummer, falls kein URL-Parameter vorhanden ist
   */
  const handleMobileSubmit = () => {
    if (!mobileNumberInput.trim()) {
      setErrorMessage('Bitte gib eine gültige Nummer ein.');
      return;
    }
    setSender(mobileNumberInput.trim());
    setErrorMessage('');
  };

  // Falls noch keine Nummer => Eingabe-Feld
  if (!sender) {
    return (
      <div
        className={`min-h-screen flex justify-center items-center ${
          darkMode ? 'bg-[#1C1C1C] text-white' : 'bg-[#F9F9F9] text-gray-900'
        }`}
      >
        <div
          className={`p-6 rounded shadow-md ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          <h1 className="text-xl font-bold mb-4">
            Bitte gib deine Mobilnummer ein
          </h1>
          <input
            type="text"
            placeholder="Mobilnummer eingeben"
            value={mobileNumberInput}
            onChange={(e) => setMobileNumberInput(e.target.value)}
            className="border p-2 w-full mb-4 text-gray-900"
          />
          <button
            onClick={handleMobileSubmit}
            className="w-full bg-blue-500 text-white py-2 rounded"
          >
            Weiter
          </button>
          {errorMessage && (
            <p className="text-red-500 mt-2">{errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // Ab hier: Dashboard
  const totalKcal = kcalEaten;
  const goalKcal = kcalBedarf || 1;
  const appBg = darkMode ? 'bg-[#1C1C1C] text-white' : 'bg-[#F9F9F9] text-gray-800';
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white shadow-sm';

  // Hilfsfunktion für die Datumslabels
  function getDateLabel(dateObj: ReturnType<typeof getDynamicDates>[0], index: number) {
    if (index !== selectedDate) {
      // Nicht ausgewählt -> nur Tag, z. B. "07"
      return dateObj.day;
    }
    // Ausgewählt
    if (dateObj.isToday) {
      return `Today, ${dateObj.day} ${dateObj.month}`;
    } else {
      return `${dateObj.day} ${dateObj.month}`;
    }
  }

  return (
    <div className={`min-h-screen transition-colors ${appBg}`}>
      {/* Oberer Bereich */}
      <div className="p-4">
        {/* Name zentriert, Darkmode-Button rechts */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold mx-auto">
            {name || 'Unbekannter Nutzer'}
          </h1>
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-gray-600 hover:bg-opacity-20 transition-colors"
          >
            {darkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>

        {/* Drei Boxen: Weight, Height, Age */}
        <div className="flex justify-around mb-4">
          {/* Weight Box */}
          <div className={`${cardBg} rounded-lg p-3 w-24 text-center`}>
            <p className="text-sm text-gray-400">Weight</p>
            <p className="text-lg font-semibold">{weight}kg</p>
          </div>
          {/* Height Box */}
          <div className={`${cardBg} rounded-lg p-3 w-24 text-center`}>
            <p className="text-sm text-gray-400">Height</p>
            <p className="text-lg font-semibold">{groesse}cm</p>
          </div>
          {/* Age Box (statisch) */}
          <div className={`${cardBg} rounded-lg p-3 w-24 text-center`}>
            <p className="text-sm text-gray-400">Age</p>
            <p className="text-lg font-semibold">25</p>
          </div>
        </div>

        {/* Date Selector (dynamisch) */}
        <div className="flex items-center justify-center space-x-1">
          {dates.map((dateObj, index) => {
            const label = getDateLabel(dateObj, index);
            const isSelected = index === selectedDate;
            return (
              <button
                key={index}
                onClick={() => setSelectedDate(index)}
                className={`px-3 py-2 rounded-full font-medium transition-colors text-sm
                  ${
                    isSelected
                      ? 'bg-[#9DC183] text-white'
                      : darkMode
                      ? 'bg-gray-700 text-gray-200'
                      : 'bg-white text-gray-700 shadow-sm'
                  }
                `}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Calories (große Zahl) */}
        <div className="text-center mb-4">
          <p className="text-gray-400">Calories</p>
          <h2 className="text-3xl font-bold">{totalKcal}</h2>
          <p className="text-sm text-gray-500">
            / {goalKcal} kcal
          </p>
        </div>

        {/* Makros: Konsumiert / Bedarf */}
        <div className="flex justify-around mb-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm">Proteins</p>
            <p className="text-lg font-bold">
              {proteinConsumed} / {proteinMain} g
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm">Carbs</p>
            <p className="text-lg font-bold">
              {carbsConsumed} / {carbsMain} g
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm">Fats</p>
            <p className="text-lg font-bold">
              {fatConsumed} / {fatMain} g
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className={`${cardBg} rounded-lg p-4 mb-4`}>
          <div className="flex items-center gap-2 mb-2">
            <UtensilsCrossed className="text-[#9DC183]" size={20} />
            <h3 className="font-bold">Calories Timeline</h3>
          </div>
          <div className="space-y-3">
            {meals.map((meal) => (
              <div key={meal.id} className="flex items-center gap-4">
                <div className="w-14 text-sm text-gray-300">{meal.time}</div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">{meal.meal_title}</span>
                    <span className="text-sm font-medium">{meal.kcal} kcal</span>
                  </div>
                  <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#9DC183] rounded-full"
                      style={{ width: `${(meal.kcal / 1000) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {!meals.length && (
              <p className="text-sm text-gray-400">
                No meals found for this day.
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid (Hydration, Workouts, Sleep, Steps) */}
        <div className="grid grid-cols-2 gap-4">
          {/* Hydration */}
          <div className={`${cardBg} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="text-[#9DC183]" size={20} />
              <h3 className="font-bold">Hydration</h3>
            </div>
            <p className="text-2xl font-bold">{hydration} L</p>
            <p className="text-sm text-gray-400">Goal: 3.0 L</p>
          </div>

          {/* Workouts */}
          <div className={`${cardBg} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell className="text-[#9DC183]" size={20} />
              <h3 className="font-bold">Workouts</h3>
            </div>
            <p className="text-2xl font-bold">{kcalWorkout}</p>
            <p className="text-sm text-gray-400">kcal burned</p>
          </div>

          {/* Sleep */}
          <div className={`${cardBg} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="text-[#9DC183]" size={20} />
              <h3 className="font-bold">Sleep</h3>
            </div>
            <p className="text-2xl font-bold">{sleep}</p>
            <p className="text-sm text-gray-400">Goal: 8h</p>
          </div>

          {/* Steps */}
          <div className={`${cardBg} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <FootprintsIcon className="text-[#9DC183]" size={20} />
              <h3 className="font-bold">Steps</h3>
            </div>
            <p className="text-2xl font-bold">{steps}</p>
            <p className="text-sm text-gray-400">Goal: 10,000</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
