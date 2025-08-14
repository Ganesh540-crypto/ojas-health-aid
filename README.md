# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/79636bec-bc40-4aba-8e70-979fe8ed8762

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/79636bec-bc40-4aba-8e70-979fe8ed8762) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Firebase Realtime Database rules (fix PERMISSION_DENIED)

If you see PERMISSION_DENIED when saving profile or chats, set RTDB rules so users can only read/write their own data:

Files included:

- `firebase.json`
- `database.rules.json`

Rules grant access to `users/$uid/**` only to the authenticated user with the same uid. Deploy them with the Firebase CLI:

1) Install Firebase CLI and initialize login once

	npm install -g firebase-tools
	firebase login

2) Set your default project (replace with your Firebase project ID)

	firebase use <your-project-id>

3) Deploy database rules from this repo root

	firebase deploy --only database

Make sure your app uses the same project in `.env` VITE_FIREBASE_* values.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/79636bec-bc40-4aba-8e70-979fe8ed8762) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
