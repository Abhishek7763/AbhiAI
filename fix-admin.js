const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data: users, error: err1 } = await supabase.auth.admin.listUsers();
  if (err1) { console.error("Error listing users:", err1); return; }
  
  const user = users.users.find(u => u.email === 'abhishekbhardwaj7763@gmail.com');
  if (!user) { console.error("User not found"); return; }
  console.log("Found user ID:", user.id);
  
  // First delete any existing
  await supabase.from('admin_users').delete().eq('email', 'abhishekbhardwaj7763@gmail.com');
  
  // Insert
  const { data, error } = await supabase.from('admin_users').insert([{ id: user.id, email: user.email }]);
  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("Success! Admin user inserted.");
  }
}
fix();
