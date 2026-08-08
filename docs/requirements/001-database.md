# Requirements: Database

* All tables shall include the following columns:
  * **id**: A UUIDv4 primary key.
  * **created_on**: DateTime corresponding with INSERT.
  * **created_by**: Foreign key reference of the user who performed the INSERT.
  * **modified_on**: DateTime corresponding with latest UPDATE or NULL.
  * **modified_by**: Foreign key reference of the user who performed the latest UPDATE or NULL.