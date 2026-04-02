# 内部設計書 (Internal Design) - TimeFit (v2 改訂版)

## 1. 強化されたデータ構造

### 1.1 タスク (`tasks`)
```javascript
{
  id: string,
  title: string,
  tags: string[],      // 新規: 分類タグの配列
  deadline: string,    // 新規: 期限日 (YYYY-MM-DD)
  description: string, // 新規: 詳細説明
  color: string,
  totalTime: number,
  parentId: string | null
}
```

### 1.2 ボード状態 (`boardState`)
`completedDuration` を廃止し、単純な時間配置のみを管理します。
```javascript
{
  "YYYY-MM-DD": [
    {
      id: string,
      taskId: string,
      duration: number // 割り当て時間のみ
    }
  ]
}
```

## 2. ロジックの実装方針

### 2.1 ステータス計算
各タスクのステータスは、現在の `date` (今日) と `boardState` の日付を比較して動的に計算します。
- `isAllAssigned`: `totalTime <= assignedTime`
- `hasFutureAssignment`: `boardState` 内のタスク割り当て日に `today` 以降が含まれるか。
- `logic`:
  - `assignedTime === 0` -> "NotStarted"
  - `isAllAssigned && !hasFutureAssignment` -> "Completed"
  - Else -> "InProgress"

### 2.2 フィルタリングとソート
`App.jsx` で `tasks` をフィルタ・ソートする関数のラップを作成し、`TaskPool` に渡す前に適用します。

### 2.3 ドラッグ＆ドロップ (DnD)
- `react-dnd` またはネイティブの `onDragStart/onDrop` を利用。
- サイドバーのカードは `taskId` を `dataTransfer` に保持し、ボード側でドロップされた際に `handleAddAssignment` を呼び出します。

## 3. 新規コンポーネント

### 3.1 `HandDrawnPopup.jsx`
- CSSの `border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;` などを用いて、手書き風のシェイプを実現。
- SVGフィルタを使用して、境界線を微妙に震わせる（有機的な線にする）表現を追加。

### 3.2 フィルタ・ソートコントロール
- `TaskPool` 内に `FilterSortControls` コンポーネントを追加。
- 状態は `App.jsx` で管理（`filterConfig`, `sortConfig`）。

## 4. IPC通信と永続化
- `saveData` は引き続き全状態をJSONで保存。
- 起動時に `loadData` で新しい属性（tags, deadline等）を読み込み、存在しない場合はデフォルト値で補完。
