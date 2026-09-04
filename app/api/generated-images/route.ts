import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const BUCKET = 'generated-images';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ images: [], authenticated: false });
  }

  const { data, error } = await supabase
    .from('generated_images')
    .select('id,prompt,enhanced_prompt,url,storage_path,provider,style,aspect_ratio,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('Could not load generated image history.', error);
    return NextResponse.json({ error: 'Could not load your cloud image history.' }, { status: 500 });
  }

  const images = await Promise.all((data ?? []).map(async (item) => {
    let imageUrl = item.url as string;
    if (item.storage_path) {
      const { data: signed, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(item.storage_path, 60 * 60);
      if (!signedError && signed?.signedUrl) imageUrl = signed.signedUrl;
    }

    return {
      id: item.id,
      imageUrl,
      prompt: item.prompt,
      enhancedPrompt: item.enhanced_prompt ?? undefined,
      provider: item.provider,
      style: item.style ?? 'photorealistic',
      aspectRatio: item.aspect_ratio ?? '1:1',
      timestamp: new Date(item.created_at).getTime(),
      cloud: true,
    };
  }));

  return NextResponse.json({ images, authenticated: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Sign in to clear cloud image history.' }, { status: 401 });
  }

  const { data: rows, error: readError } = await supabase
    .from('generated_images')
    .select('storage_path')
    .eq('user_id', user.id);

  if (readError) {
    logger.error('Could not read generated images before deletion.', readError);
    return NextResponse.json({ error: 'Could not clear cloud image history.' }, { status: 500 });
  }

  const paths = (rows ?? []).map((row) => row.storage_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) logger.warn('Some generated image files could not be removed from storage.', storageError);
  }

  const { error } = await supabase.from('generated_images').delete().eq('user_id', user.id);
  if (error) {
    logger.error('Could not delete generated image history.', error);
    return NextResponse.json({ error: 'Could not clear cloud image history.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
