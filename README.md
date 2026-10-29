# ChordPro｜和弦級數練習

可直接放在 GitHub Pages 的繁體中文和弦級數練習工具，無框架、無外部執行依賴。

## 這一版包含

- 固定順序的答案區，分開「順階和弦」與「變化和弦」。手機可正常捲動，保留頁面縮放。
- 依音高與和弦性質去重、判分，修正小調進階重複 `iv` 等選項造成的誤判。大調進階有 15 個不同答案；自然小調進階有 11 個不同答案。
- 答錯與超時後停留在解析，說明根音位置、升降記號和大／小／減三和弦的寫法；手動按下一題。
- 錯題保留調性、調式、練習方向與錯誤次數；複習連續答對兩次移出待複習，再答錯會重新加入。每回合最多 10 題。
- 7 個可自由選擇的引導單元，每單元 10 題、答對至少 8 題完成，保存最高正確率並推薦下一個未完成單元。
- 自由練習支援固定／隨機調性、大小調、正反向、級數篩選，以及獨立的出題範圍與答案範圍。
- 答題後的和弦播放、可選的 1–60 秒計時；開啟設定會暫停正在進行的計時。

## 本機預覽

Node.js 18 或更新版本，不需要 `npm install`：

```sh
npm run dev
```

開啟 `http://127.0.0.1:8766`。可用 `PORT=8767 npm run dev` 調整埠號。

## GitHub Pages

沿用原專案的 Pages 設定，將 `index.html`、`styles.css`、`trainer.js`、`app.js` 放在同一個目錄即可。不需要伺服器、資料庫或建置步驟。

若要保留原本「只替換一個 index.html」的用法：

```sh
npm run build
```

產生的 `dist/index.html` 已內嵌樣式與程式，可以單獨部署或下載後開啟；原始檔仍分開維護。

## 驗證

```sh
npm test
```

使用 Node 內建測試執行器，涵蓋大小調與所有支援調性的和弦拼寫、重複答案回歸、解析、出題範圍、錯題複習、資料還原與引導進度。

瀏覽器回歸流程記錄在 `tests/browser-scenarios.js`，使用 Playwright CLI：

```sh
playwright-cli -s=chord-test open http://127.0.0.1:8766
playwright-cli -s=chord-test run-code --filename tests/browser-scenarios.js
playwright-cli -s=chord-test close
```

此腳本僅允許 localhost，會清除該測試瀏覽器來源的 localStorage。涵蓋窄螢幕、錯題解析停留、重新載入、連答兩次清除、引導完成、反向小調判分、設定暫停計時、十次超時仍完成回合、單檔版本與無法使用儲存空間的情況。截圖位於啟動瀏覽器目錄下的 `playwright-artifacts/`。

## 資料與記譜

- 所有紀錄只存在目前瀏覽器的 localStorage；沒有上傳服務或跨裝置同步。換瀏覽器、使用不同網址或清除網站資料後，不會帶入原進度。
- `chord_settings` 延用舊版設定鍵，並遷移舊級數篩選；`chord_learning_v1` 保存新版錯題與單元進度。舊版未保存的分數無法還原。
- 自然小調使用以同主音大調為基準的標記：`i ii° ♭III iv v ♭VI ♭VII`。
- 聲音以 Web Audio 合成三和弦。此版的練習是和弦名稱／級數辨認，聲音在答題後播放。
