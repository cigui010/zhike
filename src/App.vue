<template>
  <div class="chat-app">
    <!-- 顶部导航栏 -->
    <div class="chat-header">
      <div class="header-left">
        <el-icon :size="28"><ChatDotRound /></el-icon>
        <span class="header-title">智课工坊 · AI备课助手</span>
      </div>
      <div class="header-right">
        <el-button :icon="Delete" circle size="small" @click="clearConversation" title="清空对话" />
        <el-button :icon="Refresh" circle size="small" @click="resetConversation" title="新建对话" />
      </div>
    </div>

    <!-- 中间对话区域 -->
    <div class="chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-state">
        <el-icon :size="64"><ChatDotRound /></el-icon>
        <h3>智课工坊 AI 备课助手</h3>
        <p>我是您的专属备课助手，可以帮助您：</p>
        <ul>
          <li>📝 生成教案大纲</li>
          <li>📚 整理知识点结构</li>
          <li>✏️ 设计课堂练习</li>
          <li>🎨 提供教学建议</li>
        </ul>
        <p>💡 支持语音输入和文件上传（图片、PDF、Word、TXT）</p>
      </div>

      <div v-else>
        <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.role]">
          <div class="message-avatar">
             <img  v-if="msg.role === 'user'" 
                   :src="userAvatar" 
                    alt="用户头像"
                    class="avatar-img" />
             <img  v-else 
                   :src="botAvatar" 
                    alt="智能体头像"
                   class="avatar-img" />
          </div>
          <div class="message-content">
            <div class="message-name">
              {{ msg.role === 'user' ? '我' : '智课助手' }}
              <!-- 显示思考时间 -->
              <span v-if="msg.role === 'assistant' && msg.thinkingTime" class="thinking-time">
                ⏱️ {{ formatThinkingTime(msg.thinkingTime) }}
              </span>
            </div>
            <div class="message-text" v-html="formatMessage(msg.content)"></div>
            <!-- 显示上传的文件信息 -->
            <div v-if="msg.files && msg.files.length" class="message-files">
              <div v-for="file in msg.files" :key="file.name" class="file-tag">
                <el-icon><Document /></el-icon>
                <span>{{ file.name }}</span>
              </div>
            </div>
            <!-- 给所有消息加上复制按钮 -->
            <div  class="message-actions">
              <el-button link size="small" :icon="CopyDocument" @click="copyToClipboard(msg.content)">复制</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 正在输入提示 -->
      <div v-if="isLoading" class="message assistant">
        <div class="message-avatar">
          <el-icon><Service /></el-icon>
        </div>
        <div class="message-content">
          <div class="message-name">
            智课助手
            <!-- 显示实时思考时间 -->
            <span v-if="thinkingDuration > 0" class="thinking-time">
              ⏱️ {{ formatThinkingTime(thinkingDuration) }}
            </span>
          </div>
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部输入区域 -->
    <div class="chat-input-area">
      <div class="input-wrapper">
        <!-- 工具栏 -->
        <div class="input-toolbar">
          <!-- 语音输入按钮 -->
          <el-button 
            :type="isRecording ? 'danger' : 'default'"
            :icon="Microphone" 
            circle
            @click="toggleVoiceInput"
            :title="isRecording ? '停止录音' : '语音输入'"
          />
          
          <!-- 文件上传按钮 -->
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleFileChange"
            :multiple="true"
            accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png"
          >
            <el-button :icon="FolderOpened" circle title="上传文件" />
          </el-upload>
        </div>
        
        <!-- 文本输入框 -->
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="3"
          :autosize="{ minRows: 2, maxRows: 6 }"
          :placeholder="inputPlaceholder"
          @keydown.enter.prevent="handleEnterKey"
          :disabled="isLoading"
          resize="none"
        />
        
        <div class="input-actions">
          <el-button 
            type="primary" 
            :icon="Position" 
            :loading="isLoading"
            @click="sendMessage"
            :disabled="!inputMessage.trim() && pendingFiles.length === 0"
          >
            {{ isLoading ? '思考中...' : '发送' }}
          </el-button>
        </div>
      </div>
      
      <!-- 待上传文件列表 -->
      <div v-if="pendingFiles.length > 0" class="pending-files">
        <div v-for="(file, idx) in pendingFiles" :key="idx" class="pending-file">
          <span>{{ file.name }}</span>
          <el-button link :icon="Close" @click="removePendingFile(idx)" />
        </div>
      </div>
      
      <!-- 录音状态提示 -->
      <div v-if="isRecording" class="recording-tip">
        <span class="recording-dot"></span>
        正在录音... 点击停止
      </div>
      
      <div class="input-tip">
        💡 支持语音输入 | 支持上传图片、PDF、Word、TXT文件 | Enter发送，Shift+Enter换行
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound, User, Service, Position, Delete, Refresh, CopyDocument,
  Microphone, FolderOpened, Document, Close
} from '@element-plus/icons-vue'
import request from './utils/request'

// 🔒 固定配置
const BOT_ID = '7616656258560622618'
const USER_ID = 'zhike_gongfang_fixed_user_001'
const STORAGE_KEY = 'zhike_gongfang_chat_history'

// 状态
const messages = ref([])
const inputMessage = ref('')
const isLoading = ref(false)
const messagesContainer = ref(null)
const conversationId = ref(null)

// 思考时间相关
const thinkingStartTime = ref(null)
const thinkingDuration = ref(0)
let thinkingTimer = null

// 语音相关
const isRecording = ref(false)
let speechRecognition = null

// 文件相关
const pendingFiles = ref([])
const uploadRef = ref(null)

// 占位符
const inputPlaceholder = ref('输入您的备课需求... 支持语音和文件上传')

// 格式化思考时间
const formatThinkingTime = (seconds) => {
  if (!seconds || seconds <= 0) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${secs}秒`
}

// 头像配置
const userAvatar = ref('/images/user-avatar.png')  // 用户头像路径
const botAvatar = ref('/images/bot-avatar.png')    // 智能体头像路径


// // ========== 本地存储 ==========
// const loadHistoryFromStorage = () => {
//   try {
//     const saved = localStorage.getItem(STORAGE_KEY)
//     const convId = localStorage.getItem('zhike_conv_id')
//     if (saved) {
//       messages.value = JSON.parse(saved)
//     }
//     if (convId) conversationId.value = convId
//   } catch (e) {
//     console.error('加载历史失败', e)
//   }
// }

// const saveHistoryToStorage = () => {
//   try {
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value))
//     if (conversationId.value) localStorage.setItem('zhike_conv_id', conversationId.value)
//   } catch (e) {
//     console.error('保存历史失败', e)
//   }
// }

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}

// 格式化消息
const formatMessage = (content) => {
  if (!content) return ''
  let formatted = content
  formatted = formatted.replace(/^#{1,6}\s+/gm, '')
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>')
  formatted = formatted.replace(/\n/g, '<br>')
  return formatted
}

// 复制
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败')
  }
}

// 清空对话
const clearConversation = () => {
  messages.value = []
  conversationId.value = null
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('zhike_conv_id')
  ElMessage.info('对话已清空')
}

// 重置对话
const resetConversation = () => {
  messages.value = []
  conversationId.value = null
  // localStorage.removeItem(STORAGE_KEY)
  // localStorage.removeItem('zhike_conv_id')
  ElMessage.success('已开始新对话')
  const welcomeMsg = {
    role: 'assistant',
    content: '您好！我是智课工坊AI备课助手。请告诉我您需要备什么课，我会为您生成专业的教案和建议。\n\n💡 提示：现在支持语音输入和文件上传功能！'
  }
  messages.value.push(welcomeMsg)

  // saveHistoryToStorage()
}

// 回车发送
const handleEnterKey = (event) => {
  if (event.shiftKey) return
  event.preventDefault()
  sendMessage()
}

// ========== 语音功能 ==========
const toggleVoiceInput = async () => {
  isRecording.value ? stopRecording() : await startRecording()
}

const startRecording = async () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    ElMessage.warning('当前浏览器不支持语音识别，请手动输入')
    return
  }

  try {
    speechRecognition = new SpeechRecognition()
    speechRecognition.lang = 'zh-CN'
    speechRecognition.continuous = false
    speechRecognition.interimResults = false

    speechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      inputMessage.value = transcript
      ElMessage.success(`识别结果: ${transcript}`)
    }

    speechRecognition.onerror = (event) => {
      console.error('语音识别错误:', event)
      ElMessage.error('语音识别失败，请重试')
    }

    speechRecognition.onend = () => {
      isRecording.value = false
      speechRecognition = null
    }

    speechRecognition.start()
    isRecording.value = true
    ElMessage.info('语音识别已开始，请说话')
  } catch (error) {
    console.error('语音识别启动失败:', error)
    ElMessage.error('语音识别无法启动，请检查浏览器权限')
  }
}

const stopRecording = () => {
  if (speechRecognition && isRecording.value) {
    speechRecognition.stop()
    isRecording.value = false
    ElMessage.info('语音识别已停止')
  }
}

// ========== 文件上传功能 ==========
const handleFileChange = (file) => {
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过10MB')
    return
  }
  
  pendingFiles.value.push({
    name: file.name,
    size: file.size,
    type: file.type,
    raw: file.raw
  })
  
  ElMessage.success(`已添加文件: ${file.name}`)
}

const removePendingFile = (index) => {
  pendingFiles.value.splice(index, 1)
}

const uploadFileToCoze = async (file) => {
  try {
    const formData = new FormData()
    formData.append('file', file.raw)
    
    const response = await fetch('/coze-api/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer pat_GuK6GuyxsIiDolDc0bKASy06uZQWOUYOpVxd1Rsic0iNfckNsA6atZmSePN5K6hT`
      },
      body: formData
    })
    
    const result = await response.json()
    console.log('文件上传响应:', result)
    
    if (result.code === 0 && result.data && result.data.id) {
      return { success: true, file_id: result.data.id, file_name: file.name }
    } else {
      return { success: false, error: result.msg || '上传失败' }
    }
  } catch (error) {
    console.error('文件上传异常:', error)
    return { success: false, error: error.message }
  }
}

// ========== Coze API 调用 ==========
// 解析Coze消息
const parseCozeMessage = (responseData) => {
  console.log('解析消息:', responseData)

  let items = []
  if (Array.isArray(responseData)) {
    items = responseData
  } else if (responseData?.messages && Array.isArray(responseData.messages)) {
    items = responseData.messages
  } else if (responseData?.data && Array.isArray(responseData.data)) {
    items = responseData.data
  } else {
    return "正在处理，请稍候..."
  }

  const validReplies = []

  for (let item of items) {
    let content = item.content
    if (typeof content === 'object' && content !== null) {
      content = JSON.stringify(content)
    }
    if (!content || content === '""' || content === '{}') continue

    // 过滤系统报文
    if (content.includes('"msg_type":"knowledge_recall"')) continue
    if (content.includes('"name":"biyinggugesousuo"') || content.includes('"plugin":')) continue
    if (content.includes('"plugin_id"') || content.includes('"api_name"')) continue
    if (content.includes('"result":"true"') && content.includes('"message":"认证成功"')) continue
    if (content.includes('"msg_type":"generate_answer_finish"')) continue
    if (content.trim().startsWith('{') && content.includes('"arguments"')) continue

    // 提取正常回答
    if (item.role === 'assistant') {
      try {
        const json = JSON.parse(content)
        if (json.text && typeof json.text === 'string' && json.text.trim()) {
          validReplies.push(json.text)
        } else if (typeof content === 'string' && content.trim()) {
          validReplies.push(content)
        }
      } catch {
        if (typeof content === 'string' && content.trim()) {
          validReplies.push(content)
        }
      }
    }
  }

  if (validReplies.length > 0) {
    return validReplies.sort((a, b) => b.length - a.length)[0]
  }

  return "您好！我是智课工坊AI备课助手，很高兴为您服务😊"
}

const pollChatResult = async (chatId, convId, retryCount = 0) => {
  // const maxRetries = 180  //进行180次轮询
  // const retryDelay = 2000  //每次2s
  // 动态策略：前30次2秒间隔，之后5秒间隔
  const getDelay = (count) => {
    if (count < 30) return 2000   // 前60秒，2秒一次
    return 5000                    // 之后5秒一次
  }
  
  // 最多轮询120次，最长约：30*2 + 90*5 = 60 + 450 = 510秒（8.5分钟）
  const maxRetries = 120
  
//   try {
//     const response = await request.get(`/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${convId}`)
    
//     if (response.code === 0) {
//       const status = response.data?.status
      
//       if (status === 'completed') {
//         return await getChatMessages(chatId, convId)
//       } else if (status === 'failed') {
//         throw new Error(response.data?.last_error?.msg || 'AI处理失败')
//       } else if (retryCount < maxRetries) {
//         await new Promise(resolve => setTimeout(resolve, retryDelay))
//         return await pollChatResult(chatId, convId, retryCount + 1)
//       } else {
//         throw new Error('请求超时')
//       }
//     }
//     throw new Error(response.msg || '获取状态失败')
//   } catch (error) {
//     throw error
//   }
// }

 try {
    const response = await request.get(`/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${convId}`)
    
    if (response.code === 0) {
      const status = response.data?.status
      
      if (status === 'completed') {
        const elapsed = retryCount === 0 ? 0 : 
          Array.from({length: Math.min(retryCount, 30)}).reduce((a,_,i) => a + (i<30?2000:5000), 0)
        console.log(`AI处理完成，耗时约${Math.round(elapsed/1000)}秒`)
        return await getChatMessages(chatId, convId)
      } else if (status === 'failed') {
        throw new Error(response.data?.last_error?.msg || 'AI处理失败')
      } else if (retryCount < maxRetries) {
        const delay = getDelay(retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        return await pollChatResult(chatId, convId, retryCount + 1)
      } else {
        throw new Error(`请求超时（已等待超过${maxRetries * 5}秒）`)
      }
    }
    throw new Error(response.msg || '获取状态失败')
  } catch (error) {
    throw error
  }
}

const getChatMessages = async (chatId, convId) => {
  try {
    const response = await request.get(`/v3/chat/message/list?chat_id=${chatId}&conversation_id=${convId}`)
    
    if (response.code === 0 && response.data) {
      return parseCozeMessage(response.data)
    }
    throw new Error(response.msg || '获取消息失败')
  } catch (error) {
    throw error
  }
}

// 停止思考计时器
const stopThinkingTimer = () => {
  if (thinkingTimer) {
    clearInterval(thinkingTimer)
    thinkingTimer = null
  }
}

// 开始思考计时器
const startThinkingTimer = () => {
  thinkingStartTime.value = Date.now()
  thinkingDuration.value = 0
  
  stopThinkingTimer()
  thinkingTimer = setInterval(() => {
    if (isLoading.value) {
      thinkingDuration.value = Math.floor((Date.now() - thinkingStartTime.value) / 1000)
    } else {
      stopThinkingTimer()
    }
  }, 1000)
}

const sendMessage = async () => {
  const userInput = inputMessage.value.trim()
  if (!userInput && pendingFiles.value.length === 0) return

  let uploadedFiles = []
  const currentFiles = [...pendingFiles.value]

  if (currentFiles.length > 0) {
    ElMessage.info(`正在上传 ${currentFiles.length} 个文件...`)
    for (const file of currentFiles) {
      const result = await uploadFileToCoze(file)
      if (result.success) {
        uploadedFiles.push(result)
        ElMessage.success(`文件 ${file.name} 上传成功`)
      } else {
        ElMessage.error(`文件 ${file.name} 上传失败: ${result.error}`)
      }
    }
    pendingFiles.value = []
  }

  const userMessageContent = userInput || (uploadedFiles.length > 0 ? '请分析我上传的文件' : '')
  if (!userMessageContent) {
    ElMessage.warning('请输入内容或上传文件')
    return
  }

  const userMessage = {
    role: 'user',
    content: userMessageContent
  }
  if (uploadedFiles.length > 0) {
    userMessage.files = uploadedFiles.map(f => ({ name: f.file_name }))
  }

  messages.value.push(userMessage)
  // saveHistoryToStorage()
  inputMessage.value = ''
  scrollToBottom()
  isLoading.value = true

  startThinkingTimer()

  try {
    const requestData = {
      bot_id: BOT_ID,
      user_id: USER_ID,
      stream: false
    }

    if (uploadedFiles.length > 0) {
      requestData.file_ids = uploadedFiles.map(f => f.file_id)
    }

    if (!conversationId.value) {
      // 新对话：只发当前用户消息，不发历史欢迎语
      requestData.additional_messages= [
        {
          role: "user",
          content: userMessageContent,
          content_type: "text"
        }
      ]
    } else {
      // 旧对话：正常追加
      requestData.conversation_id = conversationId.value
      requestData.additional_messages = [
        {
          role: "user",
          content: userMessageContent,
          content_type: "text"
        }
      ]
    }

    console.log('最终发送参数：', JSON.stringify(requestData, null, 2))

    const response = await request.post('/v3/chat', requestData)

    if (response.code === 0 && response.data) {
      const chatId = response.data.id
      const newConversationId = response.data.conversation_id

      if (!conversationId.value && newConversationId) {
        conversationId.value = newConversationId
        localStorage.setItem('zhike_conv_id', newConversationId)
      }

      const aiReply = await pollChatResult(chatId, newConversationId || conversationId.value)

      const aiMessage = {
        role: 'assistant',
        content: aiReply,
        thinkingTime: thinkingDuration.value
      }
      messages.value.push(aiMessage)
      // saveHistoryToStorage()
      scrollToBottom()
    } else {
      throw new Error(response.msg || `API错误: ${response.code}`)
    }
  } catch (error) {
    console.error('发送失败:', error)
    let errorMsg = '请求失败，请重试'
    if (error.response?.data) {
      errorMsg = error.response.data.msg || JSON.stringify(error.response.data)
    } else if (error.message) {
      errorMsg = error.message
    }
    const errorMessage = {
      role: 'assistant',
      content: `❌ ${errorMsg}`
    }
    messages.value.push(errorMessage)
    // saveHistoryToStorage()
    scrollToBottom()
  } finally {
    isLoading.value = false
    stopThinkingTimer()
    thinkingDuration.value = 0
  }
}

onUnmounted(() => {
  if (speechRecognition && isRecording.value) {
    speechRecognition.stop()
  }
  stopThinkingTimer()
})

onMounted(() => {
  // 每次都开启全新会话
  conversationId.value = null  // 清空会话ID，下次请求会创建新会话
  messages.value = []          // 清空消息列表

  if (messages.value.length === 0) {
    const welcomeMsg = {
      role: 'assistant',
      content: '您好！我是智课工坊AI备课助手。请告诉我您需要备什么课，我会为您生成专业的教案和建议。\n\n💡 提示：现在支持语音输入和文件上传功能！'
    }
    messages.value.push(welcomeMsg)
    // saveHistoryToStorage()
  }
  scrollToBottom()
})
</script>

<style scoped>
.chat-app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.chat-header {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #409eff;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #909399;
}

.empty-state ul {
  text-align: left;
  display: inline-block;
  margin: 20px auto;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  animation: fadeIn 0.3s ease;
}

.message.user {
  flex-direction: row-reverse;
}

.message.user .message-content {
  background: #409eff;
  color: white;
}

.message.assistant .message-content {
  background: white;
  border: 1px solid #e4e7ed;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: #409eff;
  color: white;
}

.message.assistant .message-avatar {
  background: #67c23a;
  color: white;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.message-name {
  font-size: 12px;
  margin-bottom: 6px;
  opacity: 0.7;
}

/* 思考时间样式 */
.thinking-time {
  font-size: 11px;
  color: #909399;
  margin-left: 8px;
  font-weight: normal;
}

.message-text {
  word-wrap: break-word;
}

.message-files {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(64, 158, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.message-actions {
  margin-top: 8px;
  text-align: right;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #909399;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.chat-input-area {
  background: white;
  border-top: 1px solid #e4e7ed;
  padding: 16px 24px 20px;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 4px;
}

.input-wrapper :deep(.el-textarea__inner) {
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
}

.input-actions .el-button {
  border-radius: 12px;
  padding: 10px 20px;
}

.pending-files {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pending-file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f0f2f5;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
}

.recording-tip {
  margin-top: 8px;
  text-align: center;
  color: #f56c6c;
  font-size: 12px;
}

.recording-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #f56c6c;
  border-radius: 50%;
  animation: pulse 1s infinite;
  margin-right: 6px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.input-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
  text-align: center;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 如果图片加载失败，显示背景色 */
.avatar-img {
  background: #f0f2f5;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ========== 手机端适配 ========== */
@media (max-width: 768px) {
  /* 头部内边距减小 */
  .chat-header {
    padding: 10px 16px;
  }
  
  .header-title {
    font-size: 16px;
  }
  
  /* 消息区域内边距减小 */
  .chat-messages {
    padding: 12px 10px;
  }
  
  /* 消息气泡宽度占更多 */
  .message-content {
    max-width: 85%;
    padding: 8px 12px;
  }
  
  /* 消息文字大小 */
  .message-text {
    font-size: 14px;
  }
  
  /* 消息名称字号 */
  .message-name {
    font-size: 11px;
  }
  
  /* 头像大小 */
  .message-avatar {
    width: 32px;
    height: 32px;
  }
  
  .avatar-img, .avatar-text {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }
  
  /* 输入区域内边距减小 */
  .chat-input-area {
    padding: 12px 16px 16px;
  }
  
  /* 输入框高度调整 */
  .input-wrapper :deep(.el-textarea__inner) {
    font-size: 14px;
    padding: 8px 12px;
  }
  
  /* 工具栏按钮大小 */
  .input-toolbar .el-button {
    width: 32px;
    height: 32px;
    padding: 0;
  }
  
  /* 发送按钮 */
  .input-actions .el-button {
    padding: 8px 16px;
  }
  
  /* 空状态 */
  .empty-state {
    padding: 40px 20px;
  }
  
  .empty-state h3 {
    font-size: 18px;
  }
  
  .empty-state ul {
    padding-left: 20px;
    font-size: 14px;
  }
  
  /* 底部提示文字 */
  .input-tip {
    font-size: 10px;
  }
  
  /* 文件标签 */
  .file-tag {
    font-size: 10px;
    padding: 2px 6px;
  }
  
  /* 复制按钮 */
  .message-actions .el-button {
    font-size: 11px;
    padding: 0 4px;
  }
  
  /* 思考时间文字 */
  .thinking-time {
    font-size: 10px;
  }
}

/* ========== 超小屏幕（手机小屏，如 iPhone SE） ========== */
@media (max-width: 480px) {
  .header-title {
    font-size: 14px;
  }
  
  .message-content {
    max-width: 90%;
  }
  
  .message-text {
    font-size: 13px;
  }
  
  .input-toolbar {
    gap: 6px;
  }
  
  .input-actions .el-button {
    padding: 6px 12px;
    font-size: 13px;
  }
}

/* ========== 大屏幕（PC宽屏）优化 ========== */
@media (min-width: 1200px) {
  .chat-messages {
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }
  
  .chat-input-area {
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }
}

/* ========== 优化移动端滚动体验 ========== */
.chat-messages {
  -webkit-overflow-scrolling: touch;
}
</style>