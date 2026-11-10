const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  console.log(users.users.map(u => ({ id: u.id, email: u.email })));
}
test();
