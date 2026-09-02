const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', '403fc1bd-f749-4a41-a8e4-04a97e9ef671')
    .single();
    
  console.log("AdminUser:", adminUser);
  console.log("Error:", error);
}
test();
