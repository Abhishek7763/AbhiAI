const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function list() {
  const { data: users } = await supabase.auth.admin.listUsers();
  console.log("Auth Users:", users.users.map(u => ({ id: u.id, email: u.email })));
  
  const { data: adminUsers } = await supabase.from('admin_users').select('*');
  console.log("Admin Users table:", adminUsers);
}
list();
