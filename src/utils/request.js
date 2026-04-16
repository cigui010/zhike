import axios from 'axios'

// 扣子平台API配置（通过Vite代理，解决跨域）
const COZE_API_BASE = '/coze-api'

const request = axios.create({
  baseURL: COZE_API_BASE,
  timeout: 300000,
  headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Authorization': 'Bearer pat_GuK6GuyxsIiDolDc0bKASy06uZQWOUYOpVxd1Rsic0iNfckNsA6atZmSePN5K6hT'
}
})

// 请求拦截器
request.interceptors.request.use(
  config => {
    console.log('=== 发送请求 ===')
    console.log('URL:', config.method, config.url)
    console.log('请求数据:', config.data)
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    console.log('=== 收到响应 ===')
    console.log('状态码:', response.status)
    console.log('响应数据:', response.data)
    return response.data
  },
  error => {
    console.error('=== API调用失败 ===')
    console.error('错误状态:', error.response?.status)
    console.error('错误数据:', error.response?.data)
    console.error('错误消息:', error.message)
    return Promise.reject(error)
  }
)

export default request