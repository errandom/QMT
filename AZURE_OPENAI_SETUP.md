# Azure OpenAI Setup Guide

This guide walks you through setting up Azure OpenAI for the AI-powered event creation feature.

## Prerequisites

- An Azure subscription (create one free at [azure.microsoft.com](https://azure.microsoft.com))
- Access to Azure OpenAI Service (may require approval request)

---

## Step 1: Request Access to Azure OpenAI (if needed)

Azure OpenAI requires approval for new accounts:

1. Go to [https://aka.ms/oai/access](https://aka.ms/oai/access)
2. Fill out the access request form
3. Wait for approval (usually 1-2 business days)

> **Note:** If you already have access, skip to Step 2.

---

## Step 2: Create an Azure OpenAI Resource

1. Go to [Azure Portal](https://portal.azure.com)

2. Click **"Create a resource"** (+ icon in top left)

3. Search for **"Azure OpenAI"** and select it

4. Click **"Create"**

5. Fill in the details:
   - **Subscription:** Select your Azure subscription
   - **Resource group:** Create new or select existing
   - **Region:** Choose a region (e.g., `East US`, `West Europe`, `Sweden Central`)
   - **Name:** Enter a unique name (e.g., `spark-openai`)
   - **Pricing tier:** Standard S0

6. Click **"Next"** through the tabs, then **"Create"**

7. Wait for deployment to complete (1-2 minutes)

---

## Step 3: Deploy a Model

1. Once the resource is created, click **"Go to resource"**

2. In the left menu, click **"Model deployments"** → **"Manage Deployments"**
   
   This opens Azure OpenAI Studio.

3. Click **"+ Create new deployment"**

4. Configure the deployment:
   - **Model:** Select `gpt-4o` (recommended) or `gpt-4`
   - **Deployment name:** Enter a name (e.g., `gpt-4o`)
   - **Deployment type:** Standard
   - **Tokens per minute rate limit:** Start with 10K (can increase later)

5. Click **"Create"**

---

## Step 4: Get Your Credentials

### Get the Endpoint:

1. Go back to your Azure OpenAI resource in the Azure Portal

2. In the left menu, click **"Keys and Endpoint"**

3. Copy the **Endpoint** URL
   - It looks like: `https://your-resource-name.openai.azure.com`

### Get the API Key:

1. On the same page, copy **KEY 1** or **KEY 2**

---

## Step 5: Configure the Application

Add these environment variables to your application:

### Option A: Create a `.env` file (for local development)

Create a file named `.env` in the project root:

```env
# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

### Option B: Set in Azure App Service (for production)

1. Go to your App Service in Azure Portal
2. Click **"Configuration"** in the left menu
3. Under **"Application settings"**, click **"+ New application setting"**
4. Add each variable:
   - `AZURE_OPENAI_ENDPOINT` → your endpoint URL
   - `AZURE_OPENAI_API_KEY` → your API key
   - `AZURE_OPENAI_DEPLOYMENT` → your deployment name (e.g., `gpt-4o`)
5. Click **"Save"** and restart the app

---

## Step 6: Test the Integration

1. Restart your application

2. Go to the Operations Office → Events

3. Use the "AI Create" feature with a prompt like:
   ```
   Schedule U19 practice every Tuesday at 6pm from February 1 to March 31
   ```

4. Check the server logs - you should see:
   ```
   [EventParser] Using Azure OpenAI
   ```

---

## Troubleshooting

### "Failed to parse event description"

- Check that all 3 environment variables are set correctly
- Verify the endpoint URL includes `https://` and ends with `.openai.azure.com`
- Ensure your deployment name matches exactly

### "401 Unauthorized"

- The API key is incorrect
- Copy the key again from Azure Portal → Keys and Endpoint

### "404 Not Found"

- The deployment name doesn't match
- Check your deployment name in Azure OpenAI Studio

### "429 Too Many Requests"

- You've hit your rate limit
- Increase the Tokens Per Minute in your deployment settings

---

## Cost Estimation

Azure OpenAI pricing (as of 2025):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4o | ~$2.50 | ~$10.00 |
| GPT-4 | ~$30.00 | ~$60.00 |

For this app's usage (parsing event descriptions):
- Each request uses ~500-1000 tokens
- Estimated cost: **$0.01 - $0.02 per 100 event creations**

---

## Security Best Practices

1. **Never commit API keys** to source control
2. Use **Azure Key Vault** for production deployments
3. Enable **Managed Identity** for App Service authentication (advanced)
4. Set up **Azure Monitor alerts** for unusual usage

---

## Alternative: Use Without AI

If you don't want to set up Azure OpenAI, the app will automatically fall back to a regex-based parser that handles common patterns:

- "U19 practice Tuesday at 6pm"
- "Seniors game on February 15 at 2pm"
- "Meeting every Wednesday at 7pm from January to March"

The AI provides better understanding of complex or casual language.
