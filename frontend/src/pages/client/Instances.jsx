import { useState, useEffect } from 'react'
import api from '../../services/api.js'
import toast from 'react-hot-toast'
import { FiPlus, FiTrash2, FiRefreshCw, FiWifi, FiWifiOff } from 'react-icons/fi'

export default function ClientInstances() {
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [qrData, setQrData] = useState(null)

  useEffect(() => { loadInstances() }, [])

  async function loadInstances() {
    try {
      const { data } = await api.get('/instances')
      setInstances(data)
    } catch {
      toast.error('Erro ao carregar instâncias')
    } finally {
      setLoading(false)
    }
  }

  async function createInstance() {
    setCreating(true)
    try {
      const { data } = await api.post('/instances')
      toast.success('Instância criada!')
      loadInstances()
      if (data.evolution?.qrcode?.base64) {
        setQrData({ id: data.instance.id, base64: data.evolution.qrcode.base64, name: data.instance.instanceName })
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar instância')
    } finally {
      setCreating(false)
    }
  }

  async function connectInstance(inst) {
    try {
      const { data } = await api.get(`/instances/${inst.id}/qrcode`)
      if (data?.base64) {
        setQrData({ id: inst.id, base64: data.base64, name: inst.instanceName })
      }
      toast.success('Escaneie o QR Code para conectar')
    } catch {
      toast.error('Erro ao obter QR Code')
    }
  }

  async function disconnectInstance(id) {
    try {
      await api.post(`/instances/${id}/disconnect`)
      toast.success('Desconectado!')
      loadInstances()
    } catch {
      toast.error('Erro ao desconectar')
    }
  }

  async function deleteInstance(id) {
    if (!confirm('Remover esta instância?')) return
    try {
      await api.delete(`/instances/${id}`)
      toast.success('Instância removida!')
      setQrData(null)
      loadInstances()
    } catch {
      toast.error('Erro ao remover instância')
    }
  }

  async function checkStatus(id) {
    try {
      const { data } = await api.get(`/instances/${id}/status`)
      toast.success(`Status: ${data.status}`)
      loadInstances()
    } catch {
      toast.error('Erro ao verificar status')
    }
  }

  if (loading) return <p className="dark:text-gray-300">Carregando...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Instâncias WhatsApp</h1>

      {instances.length === 0 && !qrData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 mb-6 text-center">
          <FiWifiOff size={40} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Nenhuma instância WhatsApp conectada.</p>
          <button
            onClick={createInstance}
            disabled={creating}
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            <FiPlus /> {creating ? 'Criando...' : 'Conectar WhatsApp'}
          </button>
        </div>
      )}

      {qrData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 text-center">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-1">Escaneie o QR Code com o WhatsApp</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Instância: <span className="font-medium text-gray-700 dark:text-gray-300">{qrData.name}</span></p>
          <img src={qrData.base64} alt="QR Code" className="mx-auto max-w-xs" />
          <button onClick={() => { setQrData(null); loadInstances() }} className="mt-4 text-sm text-gray-500 dark:text-gray-400 hover:underline">
            Fechar
          </button>
        </div>
      )}

      <div className="space-y-4">
        {instances.map((inst) => (
          <div key={inst.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                {inst.status === 'CONNECTED' ? <FiWifi size={20} /> : <FiWifiOff size={20} />}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">{inst.instanceName}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {inst.profileName || 'Sem perfil'} {inst.phone && `- ${inst.phone}`}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  inst.status === 'CONNECTED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  inst.status === 'CONNECTING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {inst.status === 'CONNECTED' ? 'Conectado' : inst.status === 'CONNECTING' ? 'Conectando...' : 'Desconectado'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => checkStatus(inst.id)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Verificar status">
                <FiRefreshCw size={18} />
              </button>
              {inst.status !== 'CONNECTED' ? (
                <button onClick={() => connectInstance(inst)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                  Conectar
                </button>
              ) : (
                <button onClick={() => disconnectInstance(inst.id)} className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600">
                  Desconectar
                </button>
              )}
              <button onClick={() => deleteInstance(inst.id)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Remover">
                <FiTrash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
