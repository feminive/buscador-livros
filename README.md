# Strapi Search Module for FoundryVTT

Simple module to search your Strapi content from within FoundryVTT.

## Installation

1. Copy this folder to your FoundryVTT modules directory
2. Enable the module in your world settings
3. Make sure your Strapi server is running on localhost:1339

## Usage

1. Click the search icon in the scene controls
2. Select content type (Advantages, Disadvantages, or Spells)
3. Enter search term
4. Click Search to see results

## Requirements

- FoundryVTT v11+
- Strapi server running on localhost:1339
- CORS enabled on your Strapi server

## API Structure

The module expects your Strapi API to have:
- /api/advantages
- /api/disadvantages  
- /api/spells

With standard Strapi response format.