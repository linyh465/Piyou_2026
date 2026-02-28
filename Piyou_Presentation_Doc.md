# 靜宜大學校園智慧助理 (Piyou) - 系統設計與實作簡報素材

> **說明給 AI (NotebookLM, Gamma 等) 的背景提示**：
> 這是一份用來生成「披呦 (Piyou)」系統專案簡報的參考文件。目標聽眾為**指導教授與學術評審委員**。請根據以下內容，產生一份著重於「系統架構」、「技術挑戰」、「資安設計」與「實務價值」的專題/學位發表簡報。語氣需保持專業、嚴謹且具學術性。

---

## 1. 研究背景與動機 (Background & Motivation)
- **專案名稱**：披呦 (Piyou) - 靜宜大學校園智慧助理
- **問題陳述 (Problem Statement)**： 
  - 校園資訊系統（如：選課、成績、數位學習平台）高度分散，形成資料孤島 (Data Silos)。
  - 既有系統介面老舊，缺乏對行動裝置的響應式設計 (RWD)，且無整合單一入口 (Single Sign-On / Portal)。
- **研究目的與預期貢獻**：
  - 開發一站式校園資訊入口 Web App，整合異質系統資料。
  - 導入漸進式網頁應用程式 (PWA) 技術，提供接近原生 App 的使用者體驗。
  - 實作高效能快取機制與嚴格的隱私保護策略，降低學校伺服器負載並保障學生個資安全。

## 2. 系統架構設計 (System Architecture)
本系統採前後端分離 (Decoupled Architecture) 設計，以確保系統的可維護性與擴展性。

- **前端 (Frontend)**：
  - 基於 **React 19** 與 **Vite** 建構，採用 **Zustand** 進行全域狀態管理。
  - 實作 **PWA (Progressive Web App)**，具備 Service Worker 快取能力，支援無網際網路環境下的離線讀取 (如：地下室查看課表)。
- **後端 (Backend)**：
  - 採用 **Python FastAPI** 開發，具備非同步 (Asynchronous) 高併發處理能力。
  - 建構自動化網頁解析引擎 (Web Scraper)，將傳統 HTML 網頁資料轉換為標準化 RESTful API JSON 格式。
- **基礎設施與 DevOps**：
  - 使用 **Docker** 進行容器化封裝，確保開發與生產環境的一致性。
  - 透過 **Railway** 平台進行雲端部署。

## 3. 核心功能與技術實作 (Core Features & Implementation)
- 📅 **智慧課表與成績解析模組**：
  - 開發多學期資料動態解析演算法，突破傳統硬編碼限制。
  - 實作自動化 GPA 與等第換算邏輯，即時呈現學習成效。
- 🚌 **即時交通資訊整合 (TDX API)**：
  - 串接交通部 TDX (運輸資料流通服務) OData API。
  - 解決開放資料延遲與限流問題，提供靜宜大學周邊公車即時動態。
- ✅ **分散式任務管理同步機制**：
  - 實作 Local-first 架構，前端先行儲存任務狀態，再透過 API 與伺服器進行雙向同步 (Two-way Synchronization)。
  - 透過自訂的防衝突與冷卻時間 (Cooldown) 演算法，減少不必要的伺服器請求。

## 4. 資訊安全與效能最佳化 (Security & Performance Optimization)
- **零日誌隱私保護 (Zero-Log Privacy Policy)**：
  - 系統絕不持久化儲存使用者的校園帳號密碼。
  - 於後端實作 **Zero-log Credential Filter** 中介層，強制在日誌寫入前遮蔽 (Masking) 所有敏感資訊。
- **雙層快取機制 (Dual-Layer Caching Strategy)**：
  - 實作全域快取 (Global Cache) 與獨立爬蟲快取 (Scraper Cache) 雙層架構。
  - 有效減少對靜宜大學校方伺服器的重複請求 (DDoS 風險防範)，API 平均響應時間大幅縮短。
- **安全防護中介層 (Security Middleware)**：
  - 導入 Rate Limiter 防止惡意爬蟲與暴力破解。
  - 強制 HTTPS 重導向與 JWT (JSON Web Token) 身份核實。

## 5. 結論與未來展望 (Conclusion & Future Work)
- **實務貢獻**：成功將分散的校園服務整合為單一現代化平台，大幅提升學生獲取校園資訊的效率，並透過 PWA 技術解決校園網路盲區的問題。
- **未來發展方向**：
  1. **大型語言模型 (LLM) 整合**：將現有規則導向的 AI 助理升級，導入 RAG (Retrieval-Augmented Generation) 技術，提供更精準的校園問答服務。
  2. **微服務架構 (Microservices)**：隨著使用者增加，評估將爬蟲模組與資料庫模組拆分為獨立微服務，進一步提升系統吞吐量。

---

### 給簡報生成的建議結構 (Presentation Structure for AI)：
1. **封面標題 (Title Slide)**：靜宜大學校園智慧助理 (Piyou) 系統設計與實作。
2. **研究動機與目的 (Motivation & Objectives)**：點出校園系統痛點與解決方案。
3. **系統架構圖 (System Architecture)**：前後端技術選型、Docker 與 PWA。
4. **核心技術亮點 (Technical Highlights)**：爬蟲解析、TDX 串接、資料同步。
5. **資安與效能 (Security & Performance)**：不存密碼、零日誌過濾、雙層快取策略。
6. **結論與未來展望 (Conclusion & Future Work)**：實務影響力與後續 LLM 升級計畫。
