# Fetch Backend Internship Challenge

This repository is my submission for the Fetch Backend Internship based on [this document](https://fetch-hiring.s3.us-east-1.amazonaws.com/points-intern.pdf)

> Note: The payment-status branch adds a status to the payments table. This allows for more efficient querying for payments. Closed payments are payments where the points have been completely spent.

> Closed payments can be skipped when aggregating a sum of points between payments.

> This branch is the current solution for the challenge, as the payment-status branch does not always output the same data for the `GET /balance` route although still being correct in functionality.

## Tech

-   TypeScript
-   Fastify
-   Prisma (SQLite)

## Prerequisites

-   Node.js 20+

## Getting Started

### 1) Install dependencies

```sh
npm install
```

### 2) Build

```sh
npm run build
```

### 3) Generate Prisma Client and SQLite file

```sh
npm run prisma:push
```

### 4) Start

```sh
npm start
```
