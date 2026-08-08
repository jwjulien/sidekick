# Automated Testing Reference

This project utilizes a multi-layered testing strategy tailored to our stack. Below is a quick reference guide on how to run tests for each component.

## 1. Frontend Component Tests (SolidJS)
* **Framework:** Vitest + `@solidjs/testing-library`
* **Directory:** `client/`
* **How to run:**
  ```bash
  cd client
  npm run test:unit
  ```
* *To run with the Vitest UI, use `npm run test:ui`*

## 2. Backend API Integration Tests (FastAPI/Python)
* **Framework:** Pytest + `TestClient`
* **Directory:** `server/`
* **How to run:**
  ```bash
  cd server
  poetry run pytest
  ```

## 3. End-to-End Tests (Playwright)
* **Framework:** Playwright
* **Directory:** `client/e2e/`
* **How to run:**
  ```bash
  cd client
  npm run test:e2e
  ```
* *Note: If you are running E2E tests for the first time, you must install the required browser binaries by running `npx playwright install` within the `client` directory.*

## 4. Backend App Tests (Tauri/Rust)
* **Framework:** Cargo (Built-in)
* **Directory:** `src-tauri/`
* **How to run:**
  ```bash
  cd src-tauri
  cargo test
  ```
