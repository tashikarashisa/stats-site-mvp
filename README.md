# たしからしさ (tashikarashisa)

> 確率と統計で世界を見直す、小さな研究所。宝くじからHFTまで、同じ「確率のレンズ」で降りていく個人メディア。

- サイト: https://tashikarashisa.com (公開準備中)
- note: https://note.com/tashikarashisa
- X: https://x.com/tashikarashisa

## 特徴

- **L1〜L6 の深掘り階段** — 各記事は6階層の深さで書かれ、一般読者から研究者まで同じ記事を読める
- **触れるインタラクティブ** — モンテカルロや破産確率シミュレータを記事に埋め込み、感覚に落とす
- **学術文献ベース** — 一次データではなく既発表の学術論文と一般公開情報のみを引用

## 技術スタック

| 層 | 選定 |
|---|---|
| Framework | [Astro](https://astro.build) (blog template) |
| Content | MDX + Content Collections |
| Math | KaTeX (remark-math + rehype-katex) |
| Interactive | React (client:load hydration) |
| Deploy | Vercel |
| Registrar | Cloudflare (.com only, .jp は Domain Alert 監視のみ) |

## 開発

```sh
npm install
npm run dev            # http://localhost:4321
```

CLAUDE.md の運用ルール上、Astro dev サーバはバックグラウンド起動する：

```sh
npx astro dev --background
npx astro dev status
npx astro dev logs
npx astro dev stop
```

## ディレクトリ

```
src/
├── components/
│   └── interactives/         React コンポーネント（BankruptcySimulator 等）
├── content/blog/             MDX/MD 記事
├── layouts/BlogPost.astro    記事レイアウト
├── pages/                    Home / About / Blog
├── consts.ts                 サイト名・URL
└── styles/global.css
astro.config.mjs              Astro + MDX + React + KaTeX 統合
```

## デプロイ

Vercel の Astro プリセットで自動検出、追加設定不要。

- Production: `main` ブランチが自動デプロイ
- Preview: PR ごとに Preview URL 発行
- ドメイン: Vercel Dashboard → Domains で追加 → Cloudflare 側で CNAME / A レコード設定

## ライセンス

コンテンツ（記事本文）: CC BY-NC 4.0 想定
ソースコード: MIT 想定

*注: このリポジトリは進行中。ライセンスは公開前に確定させる。*
