export async function triggerCallCenterWebhook(data: unknown): Promise<void> {
  const url = process.env.MAKE_CALL_CENTER_WEBHOOK
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function triggerPsychologistWebhook(data: unknown): Promise<void> {
  const url = process.env.MAKE_PSYCHOLOGIST_WEBHOOK
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
