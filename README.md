# Assembly Line Simulator & Optimizer

A professional, AI-powered tool for designing, simulating, and optimizing production lines. This application combines discrete event simulation with Theory of Constraints (ToC) principles and generative AI to help manufacturing engineers identify bottlenecks and improve throughput.

## 🚀 Features

- **Interactive Design Canvas**: Drag-and-drop stations, define connections, and group processes.
- **Real-Time Bottleneck Heatmap**: Visual color-coding of stations based on utilization relative to Takt time.
- **Discrete Event Simulation**: Run time-scaled simulations to see inventory accumulation and station starvation/blocking in real-time.
- **AI-Driven Insights**: Get expert suggestions for line balancing and buffer optimization using the Gemini API.
- **Comprehensive Metrics**: Track throughput, WIP (Work in Progress), Lead Time, and OEE (Overall Equipment Effectiveness).

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

### Installation

1. Clone the repository or download the source code.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

To start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

### Building for Production

To create a production-ready build:
```bash
npm run build
```
The static files will be generated in the `dist/` directory.

### Running the Production Build Locally

Because the output is a Single Page Application (SPA) consisting of static assets, you cannot just open the `index.html` file in your browser directly (due to CORS and absolute path issues). You need to serve it using a web server.

To preview the production build locally:
```bash
npm run preview
```
This will start a local server pointing to the `dist/` folder.

### Deployment

To deploy this application to a live environment:
1. **Static Hosting**: Since the app is built into static files, you can upload the contents of the `dist/` folder to any static hosting service like:
   - [Vercel](https://vercel.com/)
   - [Netlify](https://www.netlify.com/)
   - [GitHub Pages](https://pages.github.com/)
   - [AWS S3 / CloudFront](https://aws.amazon.com/s3/)
2. **Nginx/Apache**: If you are using a traditional server, point your document root to the `dist/` folder and ensure that any unknown paths are redirected to `index.html` (standard SPA routing configuration).

### Deploying to GitHub Pages

I have pre-configured the project with the `gh-pages` utility. To deploy:

1. **Initialize Git**: (If you haven't already locally)
   ```bash
   git init
   git remote add origin https://github.com/yourusername/your-repo-name.git
   ```
2. **Set the base path**: I have already set `base: './'` in `vite.config.ts`. If you are deploying to a specific sub-folder (like `username.github.io/repo-name/`), this setting ensures your images and scripts load correctly.
3. **Run the deploy command**:
   ```bash
   npm run deploy
   ```
   This command will:
   - Run `npm run build` to create a fresh `dist` folder.
   - Push the contents of `dist` to a new `gh-pages` branch on your GitHub repository.

4. **Enable on GitHub**:
   - Go to your repository on GitHub.com.
   - Go to **Settings > Pages**.
   - Under "Build and deployment", ensure the source is set to "Deploy from a branch" and select `gh-pages` / `/(root)`.

### Automatic Deployment (GitHub Actions)

I have created a GitHub Action workflow in `.github/workflows/deploy.yml` that will automatically build and deploy your application every time you push to the `main` branch.

**To enable the modern "Actions" deployment flow:**
1. Go to your repository on GitHub.com.
2. Go to **Settings > Pages**.
3. Under **Build and deployment > Source**, click the dropdown and select **GitHub Actions**.
4. Now, every push to `main` will trigger the "Deploy to GitHub Pages" job. You can monitor progress in the **Actions** tab of your repository.

## 🔑 Configuration (AI API Key)

This app uses the **Gemini API** for generating optimization insights and buffer suggestions.

1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
2. In the AI Studio Build environment, go to the **Settings** menu (gear icon) to manage your API keys.
3. Add a new secret named `GEMINI_API_KEY` and paste your key.
4. Alternatively, if running locally, create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

## 📖 How to Use

### 1. Setting up a New Production Line

1. **Clear the Canvas**: Use the "New" or "Reset" options to start with a blank slate.
2. **Set System Parameters**: In the top toolbar, define your **Target Takt Time** (the pace of customer demand).
3. **Add Stations**:
   - Click the **Station** icons in the toolbar to add Manual, Machine, or Inventory stations.
   - **Manual**: Defined by Cycle Time and FTE (Full-Time Equivalent).
   - **Machine**: Defined by Cycle Time and Batch Size.
   - **Inventory**: Acts as a buffer between processes.
4. **Configure Stations**: Click a station to open the properties panel. Define Cycle Time, Setup Time, and Reliability (MTBF/MTTR).
5. **Create Connections**:
   - Click the "Connect" tool or drag from one station to another.
   - Define **Split Percentages** for branching paths.
   - Mark connections as **Rework** paths if they return units to a previous step.

### 2. Analyzing the Design

- **Heatmap**: Toggle the "Heatmap" in Settings. Stations will turn **Red** if they exceed 95% utilization, **Yellow** for 80-95%, and **Green** for balanced flow.
- **Flow Factors**: The system automatically calculates the expected load on each station based on branching and rework loops.

### 3. Running a Simulation

1. Click the **Play** button in the Simulation controls.
2. Adjust the **Simulation Speed** to see long-term effects quickly.
3. Watch for **Starvation** (red glow) or **Blocking** (amber glow) indicators.
4. Observe inventory levels building up in buffers.

### 4. Using AI Insights

- Open the **Summary Panel** (right sidebar).
- Navigate to the **AI Insights** tab to get general line balancing suggestions.
- Navigate to the **Buffer Suggestions** tab to get specific advice on where to place inventory to protect your bottleneck from breakdowns.

## 🧪 Simulation Logic

The simulator uses a discrete event engine that accounts for:
- **Shift Patterns**: Stations only work during active shift hours.
- **Breakdowns**: Random failures based on MTBF (Mean Time Between Failures).
- **Repair Times**: Downtime duration based on MTTR (Mean Time To Repair).
- **Batching**: Machine stations process multiple units at once.
- **Learning Curves**: Manual stations improve efficiency over time.

---
*Built with React, Tailwind CSS, and Google Gemini.*
