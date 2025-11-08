-- 创建菜品表
CREATE TABLE IF NOT EXISTS dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    image_url VARCHAR(500),
    ingredients TEXT NOT NULL,
    cooking_steps TEXT,
    calories INTEGER,
    protein FLOAT,
    carbs FLOAT,
    fat FLOAT,
    is_meat BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用餐历史表
CREATE TABLE IF NOT EXISTS meal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    dish_ids UUID[],
    meal_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建购物车表
CREATE TABLE IF NOT EXISTS shopping_cart (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ingredients_json TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户配置表
CREATE TABLE IF NOT EXISTS user_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    dining_count INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category);
CREATE INDEX IF NOT EXISTS idx_dishes_is_meat ON dishes(is_meat);
CREATE INDEX IF NOT EXISTS idx_meal_history_user_id ON meal_history(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_history_meal_date ON meal_history(meal_date DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_cart_user_id ON shopping_cart(user_id);
CREATE INDEX IF NOT EXISTS idx_user_configs_user_id ON user_configs(user_id);

-- 启用行级安全
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- 创建行级安全策略
-- 菜品表：所有用户都可以读取
CREATE POLICY "任何人都可以读取菜品" ON dishes FOR SELECT USING (true);

-- 用餐历史：用户只能查看自己的记录
CREATE POLICY "用户只能查看自己的用餐历史" ON meal_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户只能插入自己的用餐历史" ON meal_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户只能更新自己的用餐历史" ON meal_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "用户只能删除自己的用餐历史" ON meal_history FOR DELETE USING (auth.uid() = user_id);

-- 购物车：用户只能管理自己的购物车
CREATE POLICY "用户只能查看自己的购物车" ON shopping_cart FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户只能插入自己的购物车" ON shopping_cart FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户只能更新自己的购物车" ON shopping_cart FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "用户只能删除自己的购物车" ON shopping_cart FOR DELETE USING (auth.uid() = user_id);

-- 用户配置：用户只能管理自己的配置
CREATE POLICY "用户只能查看自己的配置" ON user_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户只能插入自己的配置" ON user_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户只能更新自己的配置" ON user_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "用户只能删除自己的配置" ON user_configs FOR DELETE USING (auth.uid() = user_id);