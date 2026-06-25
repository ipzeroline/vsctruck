# Cartrack API Integration

## Base

- Region: Thailand
- Base URL: `https://fleetapi-th.cartrack.com/rest`
- Auth: HTTP Basic Auth with `CARTRACK_USERNAME` and `CARTRACK_PASSWORD`

## Daily Dashboard Flow

1. `GET /vehicles`
   - Source of vehicle list and registrations.
   - The current response includes `registration`, `vehicle_id`, `sensors`, and vehicle metadata.
   - It does not include the active daily driver for this account.

2. `GET /drivers`
   - Source of driver master data.
   - Used as fallback when a vehicle has a `default_driver` or linkage driver id.

3. `GET /vehicles/activity?filter[date]=YYYY-MM-DD`
   - Source of daily vehicle activity.
   - Used as the primary driver source because the response includes `drivers[]` for vehicles that used driver tags on that date.
   - Also used for report table timestamps: `first_ignition_on` and the final daily shutdown time from `last_ignition_off`.

4. `GET /vehicles/drivers/links`
   - Source of API-created current driver-vehicle linkages.
   - Used as a secondary fallback. This account currently returns no active linkage rows.

5. `GET /vehicles/{registration}/odometer`
   - Source of distance for the report window.
   - Cartrack returns `distance` in meters, so the dashboard converts it to kilometers.

6. `POST /fuel/level`
   - Source of estimated fuel usage for up to 100 registrations per request.
   - Requires supported CAN bus or fuel sensor data.
   - The requested period must not exceed 24 hours.

7. `GET /vehicles/status?odometer_in_km=true`
   - Source of live map data.
   - Returns latest status including `location.latitude`, `location.longitude`, `driver`, `speed`, `ignition`, `idling`, `fuel`, and `position_description`.
   - The dashboard uses this endpoint for the map markers, vehicle search, and live vehicle sidebar.
   - Cartrack documents this endpoint as limited to 60 calls per minute.

## Driver Priority

The dashboard resolves driver names in this order:

1. Daily activity drivers from `/vehicles/activity`
2. API-created linkage from `/vehicles/drivers/links`
3. Vehicle `default_driver` matched with `/drivers`
4. `-` when no driver data is available

## References

- Fleet API overview: https://developer.cartrack.com/docs/fleet-api-general/overview/
- Vehicle Driver Linkage: https://developer.cartrack.com/docs/fleet-api/vehicle-driver-linkage/
- Vehicles activity: https://developer.cartrack.com/docs/fleet-api/get-all-vehicles-activity/
- Odometer: https://developer.cartrack.com/docs/fleet-api/get-the-odometer-reading/
- Fuel level: https://developer.cartrack.com/docs/fleet-api/retrieve-fuel-used-estimate-for-multiple-vehicles/
- Vehicle status: https://developer.cartrack.com/docs/fleet-api/vehicle-status/

## Report Storage

- `reports`: stores every generated dashboard report snapshot, including summary, rows, text, report window, and sent status.
- `staff`: stores operational staff records with name, email, role, status, and optional Telegram chat id.
- Connection is configured through `MONGODB_URI` and `MONGODB_DB`.
- The app creates indexes on startup of storage-backed API calls for fast recent-report and staff queries.
