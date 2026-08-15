import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://crops-backend-3.onrender.com'

const client = axios.create({ baseURL: API_BASE })

export const api = {
  listDatasets: () => client.get('/api/datasets').then(r => r.data),

  listRecords: (collection, { page = 1, pageSize = 25, search = '' } = {}) =>
    client
      .get(`/api/collections/${collection}/records`, {
        params: { page, page_size: pageSize, search: search || undefined },
      })
      .then(r => r.data),

  getRecord: (collection, id) =>
    client.get(`/api/collections/${collection}/records/${id}`).then(r => r.data),

  createRecord: (collection, payload) =>
    client.post(`/api/collections/${collection}/records`, payload).then(r => r.data),

  updateRecord: (collection, id, payload) =>
    client.put(`/api/collections/${collection}/records/${id}`, payload).then(r => r.data),

  deleteRecord: (collection, id) =>
    client.delete(`/api/collections/${collection}/records/${id}`),

  getFields: (collection) =>
    client.get(`/api/collections/${collection}/fields`).then(r => r.data),
}
