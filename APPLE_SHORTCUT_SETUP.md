# Apple Fitness → Matty 7.0

This Shortcut sends the latest completed Apple Watch running workout to Matty 7.0. It is safe to run more than once: the API deduplicates the workout.

## 1. Prepare the backend

1. In Supabase, open **SQL Editor**, paste `migrate_apple_fitness.sql`, and run it.
2. Generate a private token locally:

   ```sh
   openssl rand -hex 32
   ```

3. In the Vercel project, add these Production environment variables:

   - `APPLE_SHORTCUT_TOKEN`: the generated token
   - `SUPABASE_URL`: your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role key

4. Redeploy the project after saving the variables.

Never put the service-role key in the Shortcut. The Shortcut receives only the dedicated import token.

## 2. Create “Send Workout to Matty”

In Shortcuts on the iPhone, create a new shortcut named **Send Workout to Matty**:

1. Add **Find Health Samples**.
   - Type: **Workouts**
   - Sort by: **Start Date**
   - Order: **Latest First**
   - Limit: **1**
2. Save the first result as `Workout`.
3. Use **Get Details of Health Samples** to read these details from `Workout`:
   - Start Date
   - Duration
   - Workout Activity Type
   - Total Distance
   - Total Energy Burned
4. Add **Format Date** for Start Date using custom format `yyyy-MM-dd'T'HH:mm:ssXXX`. Save it as `Start ISO`.
5. Add another **Format Date** for Start Date using `yyyy-MM-dd`. Save it as `Local Date`.
6. Convert Duration to seconds. If Shortcuts returns minutes, multiply it by `60`.
7. Convert Total Distance to kilometres. Make sure the value sent below is only the number, without the `km` suffix.
8. Add a **Dictionary** with:

   | Key | Value |
   |---|---|
   | `start_date` | `Start ISO` |
   | `local_date` | `Local Date` |
   | `workout_type` | Workout Activity Type |
   | `distance_km` | Distance in kilometres |
   | `duration_seconds` | Duration in seconds |
   | `calories` | Total Energy Burned |
   | `name` | `Apple Watch Run` |

9. Add **Get Contents of URL**:
   - URL: `https://matty-7.vercel.app/api/apple/workout`
   - Method: **POST**
   - Request Body: **JSON**
   - JSON: the Dictionary from step 8
   - Header `Authorization`: `Bearer YOUR_APPLE_SHORTCUT_TOKEN`
10. Add **Show Notification** with `Workout sent to Matty`.

Run the shortcut manually once. Allow access to Health data when prompted, then confirm the run appears in Matty 7.0.

## 3. Automate it

1. Open Shortcuts → **Automation** → **New Automation**.
2. Choose **Apple Watch Workout**.
3. Select **Ends** and the running workout types you use.
4. Choose **Run Immediately**.
5. Add **Run Shortcut** and select **Send Workout to Matty**.

If the automation fires before Health finishes saving the workout, add a **Wait** action for 10 seconds at the beginning of the shortcut.

## Optional metrics

The endpoint also accepts `avg_hr`, `max_hr`, `avg_cadence`, `avg_power`, and `elevation_gain`. These can be added later if your version of Shortcuts exposes them as workout details or if you calculate them from Health samples during the workout’s start/end window.
