# Data Storage

* All data shall be persisted to a shared database served by FastAPI.
* Data shall be saved in a SQLite database.
  * By default, this database shall be located in the 'data' directory. The location of the database shall be configurable.
* Only state and user settings may be saved locally to the Rust backend.