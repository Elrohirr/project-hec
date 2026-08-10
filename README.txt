### ROADMAP ###

1. Post request "register" and "login" with jwt - [X]
2. Create UserSchema with the propreties: name, password - []
3. Create CRUD operations for the OvertimeSchema:
 -create Overtime - [X]
 -get all Overtime - [X]
 -get single Overtime - [X]
 -update Overtime - [X]
 -delete Overtime - [X]
4. Create rule that cant have two overtimes in the same day (create and update controllers)- [X]
5. Create function that indicates when that overtime will be paid based on isHoliday atribuite - [X]
6. Add query functions for getAllOvertime controller (date, holiday, dayoff) - [X]
7. Add pagination in getAllOvertime controller - [X]

/ ------------------------------------------------------------------------------------------------------------------------------------------------------------- /

1. Create MealVoucher Schema (createdBy, referenceId, source, rule/category, date, quantity) - [X]
2. Create basic setup for mealVoucher controllers - [X]
3. Create routers - [X]
4. Create route /api/v1/mealvoucher in app.js - [X]
5. Test routes in postman - [X]
6. Create a schema that contains the source and rules of each mealVoucher - [X]
7. Create function in rules.js to determinate which rule will be used to calculate the meal voucher of an overtime - [X]
8. Create a service that create the doc in MealVoucherSchema and implement in createOvertime - [X]
9. Refactor MealVoucher controllers (only getAllMealVoucher and getMealVoucher) - [X]
10. Create service updateMealVoucher in services.js - [X]
11. Create service deleteMealVoucher in services.js -[X]
12. Implement transaction in createOvertime, updateOvertime and deleteOvertime controllers - [X]
12. Refactor mealVoucher controllers for create, update and delete for the night shifts meal vouchers - [X]
13. Add query functions for getAllMealVoucher controller (date, source) - [X]
14. Add pagination in getAllMealVoucher controller - [X]

/ ------------------------------------------------------------------------------------------------------------------------------------------------------------- /

1. Create Night shift Schema - [X]
2. Create basic setup for nightShift controllers - [X]
3. Create routers - [X]
4. Create route /api/v1/nightshift in app.js - [X]
5. Test routes in postman - [X]
6. Adapt function calcMealVocuher in rules.js to include night shifts - [X]
7. Refactor createNightShift (accepting HH:MM format) and getAllNightShifts - [X]
9. Refactor getNightShift, updateNightShift and deleteNightShift controllers - [X]
10. Add query functions for getAllNightShifts controller (date) - [ ]
11. Add pagination in getAllNightShifts controller - [ ]

/ ------------------------------------------------------------------------------------------------------------------------------------------------------------- /
