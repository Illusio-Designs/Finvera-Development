/* Multi-phase Facebook publishing. Persist safe upload steps; mark the final
   write before calling it so an uncertain outcome never gets auto-repeated. */
async function publishFacebookFormat({ page, token, media, caption, format, checkpoint: cp, save }, api) {
  const story = /story|stories/i.test(format || '');
  const file = media[0];
  if (media.length !== 1 || !file) throw new Error('A Story or Reel needs exactly one image or video.');
  const video = api.isVideo(file);
  if (!story && !video) throw new Error('A Reel needs one video.');
  const mark = async () => { cp.publishCalled = true; await save(cp); };
  if (story && !video) {
    if (!cp.photoId) { const result = await api.graph('POST', `/${page}/photos`, { url: file.url, published: 'false', access_token: token }); cp.photoId = result.id; await save(cp); }
    await mark();
    const result = await api.graph('POST', `/${page}/photo_stories`, { photo_id: cp.photoId, access_token: token });
    if (!result.post_id) throw new Error('Facebook did not return a Story post ID. Check the Page before retrying.');
    return { id: String(result.post_id), url: result.url || null };
  }
  if (cp.publishedConfirmed && !cp.videoId) throw new Error("The published video checkpoint is incomplete. Check the Page before retrying.");
  const endpoint = `/${page}/${story ? 'video_stories' : 'video_reels'}`;
  if (!cp.videoId) {
    const started = await api.graph('POST', endpoint, { upload_phase: 'start', access_token: token });
    if (!started.video_id || !started.upload_url) throw new Error('Facebook did not create a video upload session.');
    cp.videoId = String(started.video_id); cp.uploadUrl = started.upload_url; await save(cp);
  }
  if (!cp.uploaded) {
    // A crashed upload may have completed. Check before resending the file.
    const state = await api.graph('GET', `/${cp.videoId}`, { fields: 'status', access_token: token });
    if (!['complete','completed'].includes(state.status?.uploading_phase?.status) && state.status?.video_status !== 'ready') await api.uploadHosted(cp.uploadUrl, file.url, token);
    cp.uploaded = true; await save(cp);
  }
  if (!cp.publishedConfirmed) {
    await mark();
    const result = await api.graph('POST', endpoint, { upload_phase: 'finish', video_id: cp.videoId, ...(story ? {} : { video_state: 'PUBLISHED', description: caption }), access_token: token });
    if (result.success === false) throw new Error('Facebook did not confirm publication. Check the Page before retrying.');
    await api.waitForPublished(cp.videoId, token);
    cp.publishedId = String(result.post_id || cp.videoId);
    const info = await api.graph('GET', `/${cp.publishedId}`, { fields: 'permalink_url', access_token: token }).catch(() => ({}));
    cp.publishedUrl = info.permalink_url || result.url || (story ? null : `https://www.facebook.com/reel/${cp.videoId}`);
    cp.publishedConfirmed = true; cp.coverPending = !story && !!file.coverUrl && !cp.coverUploaded; await save(cp);
  }
  if (cp.coverPending) {
    try { await api.uploadCover(cp.videoId, file.coverUrl, token); }
    catch (error) { error.publishStage = 'cover'; error.message = `The Facebook Reel is live, but its cover was not applied. Check thumbnail permissions in Readiness & actions, then Retry to update only the cover: ${error.message}`; throw error; }
    cp.coverUploaded = true; cp.coverPending = false; await save(cp);
  }
  return { id: cp.publishedId, url: cp.publishedUrl };
}
module.exports = { publishFacebookFormat };
