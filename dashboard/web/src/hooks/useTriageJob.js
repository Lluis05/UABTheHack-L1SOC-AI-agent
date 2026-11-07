import { useState } from 'react'
import { socService } from '../services/socService.js'
import { JOB_STATUS, POLL_TRIAGE_MS } from '../config/constants.js'
import { useInterval } from './useInterval.js'

// Lanza un triaje en directo y sigue su progreso hasta que termina.
export function useTriageJob(onFinished) {
  const [jobId, setJobId] = useState(null)
  const [job, setJob] = useState(null)
  const [error, setError] = useState('')
  const running = Boolean(jobId) && job?.status !== JOB_STATUS.DONE && job?.status !== JOB_STATUS.ERROR

  async function poll() {
    try {
      const status = await socService.triageStatus(jobId)
      setJob(status)
      if (status.status !== JOB_STATUS.RUNNING) onFinished()
    } catch (e) {
      setError(e.message)
      setJobId(null)
    }
  }
  useInterval(poll, POLL_TRIAGE_MS, running)

  async function start(body) {
    setError('')
    try {
      const { job_id: id } = await socService.startTriage(body)
      setJob(null)
      setJobId(id)
    } catch (e) {
      setError(e.message)
    }
  }

  return { job, error, running, start, setError }
}
