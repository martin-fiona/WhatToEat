// Test script to verify average nutrition calculation logic
// This simulates the behavior of the getAverageNutrition function

function testAverageNutrition() {
  // Mock data - simulating meals for different days
  const mockMeals = [
    { date: '2024-01-01', calories: 500, protein: 20, carbs: 60, fat: 15 },
    { date: '2024-01-01', calories: 600, protein: 25, carbs: 70, fat: 20 },
    { date: '2024-01-02', calories: 450, protein: 18, carbs: 55, fat: 18 },
    { date: '2024-01-02', calories: 550, protein: 22, carbs: 65, fat: 22 },
    { date: '2024-01-03', calories: 480, protein: 19, carbs: 58, fat: 16 },
  ];

  // Simulate getNutritionData() function
  function getNutritionData(timeRange) {
    const dailyData = {};
    
    // Filter meals based on time range
    const filteredMeals = mockMeals.filter(meal => {
      const mealDate = new Date(meal.date);
      const today = new Date('2024-01-03'); // Simulate today
      const daysDiff = Math.floor((today - mealDate) / (1000 * 60 * 60 * 24));
      
      return daysDiff < parseInt(timeRange);
    });

    // Group by date and sum nutrition
    filteredMeals.forEach(meal => {
      if (!dailyData[meal.date]) {
        dailyData[meal.date] = {
          date: meal.date,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        };
      }
      dailyData[meal.date].calories += meal.calories;
      dailyData[meal.date].protein += meal.protein;
      dailyData[meal.date].carbs += meal.carbs;
      dailyData[meal.date].fat += meal.fat;
    });

    return Object.values(dailyData);
  }

  // Simulate getAverageNutrition() function with our fix
  function getAverageNutrition(timeRange) {
    const daily = getNutritionData(timeRange);
    const dayCount = daily.length;
    
    if (dayCount === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

    const totals = daily.reduce(
      (acc, d) => ({
        calories: acc.calories + (d.calories || 0),
        protein: acc.protein + (d.protein || 0),
        carbs: acc.carbs + (d.carbs || 0),
        fat: acc.fat + (d.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    // 如果选择的是"今天"，直接返回总量（因为只统计了一天）
    if (timeRange === '1') {
      return {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
      };
    }

    // 其他时间范围：计算真正的平均值（基于选择的天数，而不是有数据的天数）
    const selectedDays = parseInt(timeRange);
    return {
      calories: Math.round(totals.calories / selectedDays),
      protein: Math.round(totals.protein / selectedDays),
      carbs: Math.round(totals.carbs / selectedDays),
      fat: Math.round(totals.fat / selectedDays),
    };
  }

  // Test different time ranges
  console.log('=== Testing Average Nutrition Calculation ===\n');
  
  console.log('Today (timeRange = "1"):');
  const todayAvg = getAverageNutrition('1');
  console.log('Average:', todayAvg);
  console.log('Expected: Should equal today\'s total (480 calories)\n');
  
  console.log('7 days (timeRange = "7"):');
  const sevenDayAvg = getAverageNutrition('7');
  console.log('Average:', sevenDayAvg);
  console.log('Expected: Should be total / 7 days\n');
  
  console.log('30 days (timeRange = "30"):');
  const thirtyDayAvg = getAverageNutrition('30');
  console.log('Average:', thirtyDayAvg);
  console.log('Expected: Should be total / 30 days\n');
  
  // Verify the logic
  console.log('=== Verification ===');
  console.log('Today calories:', todayAvg.calories, '(should be 480)');
  console.log('7-day average calories:', sevenDayAvg.calories, '(should be total/7)');
  console.log('30-day average calories:', thirtyDayAvg.calories, '(should be total/30)');
}

// Run the test
testAverageNutrition();