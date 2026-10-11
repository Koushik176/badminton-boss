# Badminton Boss

# Badminton Tournament Hosting Web Application

## 1. Project Overview

Build a modern, responsive web application for hosting and managing local badminton double s tournaments at a badminton court.

The application should allow a tournament organizer to:

* Create a tournament.
* Add players.
* Automatically create random doubles teams.
* Shuffle teams until the organizer is satisfied.
* Alternatively create manually defined teams.
* Choose between Knockout and League tournament formats.
* Automatically generate and manage the tournament match schedule.
* Start and manage individual matches.
* Conduct a virtual coin toss before every match.
* Track serving and receiving players.
* Track doubles player positions/rotation throughout the match according to badminton rules.
* Record badminton scores using official rally-point scoring rules.
* Automatically determine the winner.
* Maintain tournament standings.
* Maintain individual player statistics across all tournaments.
* Provide leaderboards for players.
* Allow matches to be skipped/reordered during a tournament.

The application is intended primarily for a local badminton court, but the architecture should be designed so it can eventually support multiple courts, tournaments and users.

---

# 2. Important Product Principle

This is not just a CRUD application.

The most important part of the application is the **live badminton match engine**.

The scoring, serving, receiving, player positions and doubles rotation must be modeled as application state and updated automatically when points are scored.

Do NOT simply create a score-entry form.

The application must understand:

* Doubles badminton.
* Rally-point scoring.
* Serving team.
* Receiving team.
* Server.
* Receiver.
* Server's teammate.
* Receiver's teammate.
* Right/left service courts.
* Service rotation.
* Which player should serve after winning a rally.
* Which player should receive the next serve.
* Score-based service court changes.
* Game/match completion.
* Deuce at 20–20.
* Two-point winning requirement.
* 30-point maximum.
* Match statistics.

The badminton rules should be implemented as deterministic business logic rather than being manually controlled by the organizer wherever possible.

---

# 3. Recommended Technology Stack

Use a modern web stack.

Preferred:

* Preferred: Frontend: React + TypeScript
* UI: Tailwind CSS
* Component library: shadcn/ui
* Icons: Lucide
* Backend: Node.js + Express
* Database: MongoDB or MySQL
* Authentication: JWT or equivalent
* State management: React state/context or Zustand
* API communication: REST or GraphQL
* Form validation: Zod
* Charts/statistics: Recharts, Nivo or equivalent

The application must be responsive and work well on:

* Desktop
* Laptop
* Tablet
* Mobile

The organizer will frequently use the application from a mobile/tablet beside the badminton court, so the **live scoring screen must be optimized for touch interaction**.

---

# 4. Main Application Sections

Create the following major sections:

1. Dashboard
2. Tournaments
3. Create Tournament
4. Tournament Details
5. Teams
6. Players
7. Match Schedule
8. Live Match
9. League Standings
10. Tournament Results
11. Player Statistics
12. Leaderboards
13. Settings

Use a clean sports-oriented UI.

The application should look like a professional badminton tournament management system rather than a generic admin dashboard.

---

# 5. Dashboard

Dashboard should show:

* Total tournaments
* Active tournament
* Completed tournaments
* Total players
* Total matches played
* Recent tournaments
* Current live match
* Upcoming matches
* Top players
* Quick actions:

  * Create Tournament
  * Add Player
  * View Active Tournament

If a tournament is currently running, show an obvious "Continue Tournament" button.

---

# 6. Player Management

Players are global entities.

A player can participate in:

* Multiple tournaments
* Different teams
* Different partners

Do not permanently associate a player with a single team.

Player fields:

```text
id
name
display_name
phone (optional)
profile_image (optional)
created_at
updated_at
```

Player profile should show:

* Total tournaments
* Total matches
* Matches won
* Matches lost
* Win percentage
* Total points scored
* Total points conceded
* Point difference
* Games won
* Games lost
* Current ranking/leaderboard position
* Tournament history
* Partners played with
* Teams played with

The same player must be reusable in future tournaments.

---

# 7. Tournament Creation

Create a multi-step tournament creation wizard.

## Step 1 — Tournament Information

Fields:

* Tournament name
* Date
* Location
* Tournament type:

  * Knockout
  * League
* Number of courts (optional)
* Description (optional)

---

# 8. Team Creation

Provide two options:

## Option A — Random Teams

Organizer enters player names.

Example:

```text
Rahul
Arun
Kiran
Vijay
Ajay
Rohit
Suresh
Manoj
```

The number of players must be even.

Validation:

```text
if players.length % 2 !== 0:
    show error:
    "Doubles teams require an even number of players."
```

Do not allow tournament creation until the issue is resolved.

After entering players:

Automatically randomly create teams of two.

Example:

```text
Team A
Rahul + Kiran

Team B
Arun + Vijay

Team C
Ajay + Manoj

Team D
Rohit + Suresh
```

Show a **Shuffle Teams** button.

Every time the organizer presses Shuffle:

* Randomize the players again.
* Generate new pairs.
* Display the new teams.

Avoid creating the exact same team arrangement unnecessarily.

Allow the organizer to:

* Shuffle again
* Rename teams
* Edit team members
* Lock a team if desired
* Confirm teams

Example:

```text
[ Shuffle Teams ]

Team A
Rahul
Kiran

Team B
Arun
Vijay

[ Confirm Teams ]
```

---

# 9. Manual Team Creation

Provide a second option:

```text
Create Teams Manually
```

Organizer can define:

```text
Team A
Player 1
Player 2

Team B
Player 3
Player 4

Team C
Player 5
Player 6
```

Validation:

* Each team must contain exactly 2 players.
* A player cannot belong to two teams in the same tournament.
* Every registered player must belong to a team.
* Team names must be unique within the tournament.

Allow custom team names.

Example:

```text
Smashers
Rahul
Kiran
```

---

# 10. Tournament Types

The organizer must choose:

```text
Knockout
League
```

The application should use different tournament scheduling and result logic depending on the selected type.

---

# 11. Knockout Tournament

For knockout tournaments:

Automatically generate the bracket.

Example for 8 teams:

```text
Quarter Final 1
Team A vs Team H

Quarter Final 2
Team D vs Team E

Quarter Final 3
Team B vs Team G

Quarter Final 4
Team C vs Team F

        ↓

Semi Final 1
Winner QF1 vs Winner QF2

Semi Final 2
Winner QF3 vs Winner QF4

        ↓

Final
Winner SF1 vs Winner SF2
```

Randomize the initial matchup order.

The organizer should be able to regenerate/shuffle the initial bracket before the tournament starts.

---

# 12. Knockout Scheduling

Once the tournament starts:

Show a schedule page.

Example:

```text
NEXT MATCH

Quarter Final 1

Team Smash
Rahul + Kiran

VS

Team Warriors
Arun + Vijay

[ Start Match ]
[ Skip Match ]
```

Also show:

```text
Upcoming Matches
Completed Matches
Skipped Matches
```

The organizer must be able to skip the current match.

When Skip Match is selected:

Show options:

```text
Skip for now
Move to end of schedule
Select position
```

Allow the organizer to place the match at any position in the remaining schedule.

Example:

```text
Move Match To:
[ Position 3 ▼ ]

[ Confirm ]
```

Do not change the tournament bracket logic merely because the playing order changes.

The bracket determines who advances.

The schedule determines when the match is played.

These must be separate concepts.

---

# 13. League Tournament

For League format, every team should play against every other team.

For N teams:

Number of League Matches = N × (N - 1) / 2

Example for 4 teams:

Team A vs Team B
Team A vs Team C
Team A vs Team D
Team B vs Team C
Team B vs Team D
Team C vs Team D

Generate all fixtures automatically.

Randomize the initial playing order.

Allow the organizer to reorder matches just like knockout tournaments.

League Final

After all league matches are completed, the application must calculate the final league standings.

The teams finishing:

1st Position
2nd Position

will qualify for a League Final.

The League Final will be:

1st Position Team vs 2nd Position Team

The winner of this final becomes the Tournament Champion.

The league table itself determines the finalists, but the tournament champion must be determined by the result of the final match.

The League Final must be added automatically to the tournament schedule after all league matches are completed.

Example:

FINAL LEAGUE TABLE

1. Team A
2. Team C
3. Team B
4. Team D

             ↓

LEAGUE FINAL

Team A vs Team C

             ↓

Winner

TOURNAMENT CHAMPION

The final should not be treated as another regular league fixture.

It must be stored separately as:

match_type = "LEAGUE_FINAL"

The final must not affect the regular league standings.

---

# 14. League Points Table

Maintain a live standings table.

Columns:

| Team | MP | W | L | Points | Point Difference |
| ---- | -- | - | - | ------ | ---------------- |

Definitions:

```text
MP = Matches Played
W = Matches Won
L = Matches Lost
Points = Matches Won × 2
Point Difference = Total Points Scored - Total Points Conceded
```

Example:

```text
Team A | 3 | 2 | 1 | 4 | +12
Team B | 3 | 2 | 1 | 4 | +5
Team C | 3 | 1 | 2 | 2 | -4
Team D | 3 | 1 | 2 | 2 | -13
```

Point Difference must be calculated cumulatively across every match.

Example:

Match 1:

```text
Team A 21 - 17 Team B
```

Team A:

```text
+4
```

Team B:

```text
-4
```

Match 2:

```text
Team A 21 - 15 Team C
```

Team A:

```text
+6
```

Cumulative:

```text
+10
```

Do not calculate point difference only from the most recent match.

---

# 15. League Ranking Rules

Default ranking:

1. Highest tournament points
2. Highest point difference
3. Highest points scored
4. If still tied, use head-to-head result
5. If still tied, allow organizer to resolve manually

Make ranking logic configurable in the future.

---

# 16. Tournament Start

Before starting the tournament, show a confirmation screen:

```text
Tournament Ready

Tournament:
Local Badminton Championship

Type:
League

Teams:
8

Matches:
28

[ Start Tournament ]
```

Once started:

* Teams should not be casually editable.
* Match fixtures should be locked unless organizer explicitly edits them.
* Tournament status becomes `LIVE`.

Allow an administrator/organizer to pause or reset a tournament with confirmation.

---

# 17. Match Preparation

When organizer selects:

```text
Start Match
```

Open a match preparation screen.

Display:

```text
Team A
Rahul + Kiran

VS

Team B
Arun + Vijay
```

---

# 18. Coin Toss

Implement a visual coin toss.

Show:

```text
COIN TOSS

Team A
Team B

[ Toss Coin ]
```

Animate the coin.

Randomly select:

```text
Team A wins toss
```

Winner gets options:

```text
Choose:

○ Court
○ Serve
```

If winner chooses Court:

Opponent automatically chooses Serve.

If winner chooses Serve:

Opponent automatically chooses Court.

The result must be clearly displayed.

Example:

```text
Toss Winner:
Team A

Team A chose:
Serve

Team B chooses:
Court
```

---

# 19. Court Selection

Represent the court visually.

Example:

```text
┌──────────────────┐
│                                                         │
│          TEAM B                                │
│                                                         │
│------------- NET -------------│
│                                                         │
│          TEAM A                                │
│                                                         │
└──────────────────┘
```

Allow selection of:

```text
Court Side A
Court Side B
```

Keep court side information for the match.

---

# 20. Initial Server and Receiver

After toss:

The organizer must select:

### Serving Team

Already determined by toss.

Then select:

```text
Who is serving?

○ Rahul
○ Kiran
```

Then select receiving player:

```text
Who is receiving?

○ Arun
○ Vijay
```

Validate:

* Server belongs to serving team.
* Receiver belongs to receiving team.

Do not allow invalid combinations.

The application should then calculate the correct service court based on the server's team's score.

---

# 21. Live Match Screen

This is the most important screen in the application.

Design it for a badminton court-side environment.

Large touch-friendly controls.

Example:

```text
┌─────────────────────────────────────────────┐
│             LIVE MATCH                      │
│                                             │
│ Team A                Team B                │
│ Rahul                 Arun                  │
│ Kiran                 Vijay                 │
│                                             │
│       12                 10                  │
│                                             │
│ [ + POINT ]          [ + POINT ]            │
│                                             │
│ Server: Rahul                               
│ Receiver: Arun                              │
│                                             │
│ Current Rally                               │
│                                             │
│ [ Undo Last Point ]                         │
│ [ Pause Match ]                             │
│ [ End Match ]                               │
└─────────────────────────────────────────────┘
```

Buttons must be very large for mobile/tablet use.

---

# 22. Badminton Scoring Rules

Implement standard badminton rally-point scoring.

For a doubles game:

* Every rally awards one point.
* A game normally ends at 21 points.
* At 20–20, the side must lead by 2 points to win.
* If the score reaches 29–29, the side scoring the 30th point wins.
* Maximum score is therefore 30.
* The winning team must have at least 21 points.
* Match Format

The match format must be configurable in the Tournament Settings.

Available options:

Best of 1
Best of 3

Default:

Best of 1
Best of 1

One game is played.

The team that wins the game wins the match.

Example:

Team A 21 - 18 Team B

Winner:
Team A

Best of 3

A team must win 2 games to win the match.

Example:

Game 1: Team A 21 - 18 Team B
Game 2: Team B 21 - 17 Team A
Game 3: Team A 21 - 16 Team B

Match Winner:
Team A

The selected match format should be stored with the tournament/match configuration so that the scoring engine knows whether to finish after one game or continue to another game.

Important League Final Rule

The League Final is always Best of 1, regardless of the regular league match format configured for the tournament.

For example, if regular league matches are configured as:

Best of 3

the League Final must still be:

Best of 1

The application should clearly display this before the final starts:

LEAGUE FINAL

Team A
VS
Team C

Match Format:
Best of 1

Do not allow the organizer to change the League Final to Best of 3.

---

# 23. Scoring Engine

Create a dedicated scoring engine.

Do not implement scoring logic directly inside React components.

Create a service/module such as:

```text
badmintonScoring.ts
```

Responsibilities:

```text
addPoint(team)
determineWinner()
determineNextServer()
determineNextReceiver()
determineServiceCourt()
isGameFinished()
isMatchFinished()
startNextGame()
```

The scoring engine must be deterministic and testable.

---

# 24. Doubles Serving Rules

Implement badminton doubles serving rules correctly.

Important principles:

* The serving side changes whenever the serving side loses a rally.
* If the serving side wins a rally, it scores a point and the same server serves again.
* The server serves from:

  * Right service court when their team's score is even.
  * Left service court when their team's score is odd.
* The receiver is the player diagonally opposite the server.
* The server's partner remains in the other service court.
* The receiving team's non-receiver remains in the other receiving court.
* Players do not change service courts merely because they win a rally; the serving pair changes sides according to the serving team's score and the serving player remains the server while they continue winning rallies.

The system should track the actual player position rather than merely displaying a static server name.

---

# 25. Player Position Tracking

This is a critical feature.

The application must visually display the four players on the doubles court.

Example:

```text
              OPPONENT COURT

       ┌───────────────────────┐
       │                                                                          │
       │      Partner                                                      │
       │                                                                          │
       │                                          Receiver               │                           
       │                                                                          │
       ├────────── NET ──────────┤
       │                                                                          │
       │      Server                                                       │
       │                                                                          │
       │                                            Partner                │                             
       │                                                                           │
       └─────────────────────── ┘
```

Use labels:

```text
SERVER
SERVER PARTNER
RECEIVER
RECEIVER PARTNER
```

Also display:

```text
Left Court
Right Court
```

The court visualization should update after every rally.

---

# 26. Position State

Maintain a structured position state.

Example:

```typescript
type CourtPosition = {
    teamASide: "top" | "bottom";
    teamAPlayer1Court: "left" | "right";
    teamAPlayer2Court: "left" | "right";

    teamBSide: "top" | "bottom";
    teamBPlayer1Court: "left" | "right";
    teamBPlayer2Court: "left" | "right";

    serverPlayerId: string;
    receiverPlayerId: string;
}
```

Do not rely only on UI state.

Persist the match state.

---

# 27. Position Updates After Rally

When serving team wins:

1. Serving team receives one point.
2. Same player continues serving.
3. Serving pair changes service court positions.
4. Server's position is updated according to the new score.
5. Receiver remains the same receiver.
6. Receiving team's partner remains on their existing side.

When receiving team wins:

1. Receiving team receives one point.
2. Service changes to the previously receiving team.
3. Determine the new server based on the serving team's score.
4. Determine the receiver diagonally opposite the new server.
5. Update player positions accordingly.

Make this logic part of the badminton rules engine.

---

# 28. Rally History

Maintain a complete rally history.

Example:

```text
Rally 1
Team A won
Score: 1 - 0
Server: Rahul

Rally 2
Team B won
Score: 1 - 1
Server: Vijay

Rally 3
Team B won
Score: 1 - 2
Server: Vijay
```

Allow organizer to:

```text
Undo Last Point
```

Undo must restore the complete previous state, including:

* Score
* Server
* Receiver
* Player positions
* Service court
* Game state
* Match state

Do not simply subtract one from the score.

Use state snapshots/event history so undo is reliable.

---

# 29. Match Score Display

Display:

```text
Team A
21

Team B
18
```

If best-of-3:

```text
Games

Team A: 1
Team B: 0

Current Game:
21 - 18
```

Also show previous game scores:

```text
Game 1: 21 - 18
Game 2:  -
Game 3:  -
```

---

# 30. Match Completion

When a game is won:

Show:

```text
GAME WON

Team A
21 - 18

[ Start Next Game ]
```

If the match is won:

```text
MATCH COMPLETE

Team A
Wins

Games:
2 - 1

Scores:
21-18
18-21
21-16
```

Require organizer confirmation before finalizing the result.

---

# 31. Match Result

Store:

```text
match_id
tournament_id
team_a_id
team_b_id

winner_team_id
loser_team_id

games_played

game_1_team_a_score
game_1_team_b_score

game_2_team_a_score
game_2_team_b_score

game_3_team_a_score
game_3_team_b_score

total_team_a_points
total_team_b_points

started_at
completed_at
```

Also store detailed rally information if practical.

---

# 32. Match State Persistence

The live match must survive:

* Browser refresh
* Accidental navigation
* Temporary network failure

Save the match state continuously.

For example:

```text
match status:
scheduled
ready
live
paused
completed
skipped
```

If the organizer refreshes the page during a live match:

```text
Resume Live Match
```

must restore:

* Current score
* Game
* Server
* Receiver
* Positions
* Rally history
* Toss result

---

# 33. Schedule Management

Every tournament should have a schedule.

Each match should have:

```text
Match #
Round
Team A
Team B
Status
Scheduled Order
Court
Winner
```

Statuses:

```text
Upcoming
Ready
Live
Completed
Skipped
```

Organizer actions:

```text
Start
Skip
Move Up
Move Down
Move To Position
```

The schedule order must be independent of knockout bracket relationships.

---

# 34. Knockout Advancement

After a knockout match completes:

Automatically place the winner into the next bracket position.

Example:

```text
QF1 Winner
      ↓
SF1
```

Do not ask the organizer to manually enter the winner unless there is an override function.

Provide an administrator override for corrections.

---

# 35. League Completion

When all regular league matches are completed:

1. Calculate the final league standings.
2. Determine the team in 1st position.
3. Determine the team in 2nd position.
4. Automatically create a League Final fixture.
5. Add the League Final to the tournament schedule.
6. Allow the organizer to start the League Final.
7. The League Final must be played as Best of 1.
8. The winner of the League Final becomes the Tournament Champion.

Example:

REGULAR LEAGUE COMPLETED

Final Standings:

1. Team A
   MP: 5
   W: 4
   L: 1
   Points: 8
   Point Difference: +35

2. Team C
   MP: 5
   W: 4
   L: 1
   Points: 8
   Point Difference: +21

3. Team B
   MP: 5
   W: 2
   L: 3
   Points: 4
   Point Difference: -4

4. Team D
   MP: 5
   W: 0
   L: 5
   Points: 0
   Point Difference: -52

The application then automatically creates:

LEAGUE FINAL

Team A
VS
Team C

Format:
Best of 1

After the final:

LEAGUE FINAL RESULT

Team A 21 - 17 Team C

TOURNAMENT CHAMPION:
Team A

RUNNER-UP:
Team C
Important

The League Final result must not modify the regular league standings.

The league standings are used only to determine the two finalists.

The final match determines:

Tournament Champion
Tournament Runner-up

Store the final separately from the league fixtures.

Recommended match types:

LEAGUE_MATCH
LEAGUE_FINAL
KNOCKOUT_QUARTER_FINAL
KNOCKOUT_SEMI_FINAL
KNOCKOUT_FINAL

---

# 36. Tournament Results

The tournament results page should display:

* Champion
* Runner-up
* Final standings
* Match results
* Team statistics
* Player statistics
* Total points
* Point difference
* Match history

---

# 37. Player Statistics

Maintain global player statistics across tournaments.

Example player profile:

```text
Rahul

Tournaments: 12
Matches: 35
Wins: 24
Losses: 11
Win Rate: 68.57%

Games Won: 51
Games Lost: 29

Points Scored: 1,245
Points Conceded: 1,102

Point Difference: +143
```

Do not treat a player's tournament team as permanent.

Track partnerships historically.

Example:

```text
Partners

Kiran       12 matches
Arun         5 matches
Vijay        3 matches
```

---

# 38. Player Leaderboard

Create a leaderboard.

Possible ranking metrics:

### Wins

```text
Rank | Player | Wins
```

### Win Percentage

```text
Rank | Player | Win %
```

### Point Difference

```text
Rank | Player | Point Difference
```

### Tournament Points

```text
Rank | Player | Tournament Points
```

Allow filtering:

```text
All Time
This Year
This Month
Tournament
```

---

# 39. Database Design

Use a normalized relational database.

Suggested entities:

```text
users
players
tournaments
tournament_players
teams
team_players
matches
match_games
match_rallies
match_positions
tournament_standings
player_statistics
coin_tosses
match_schedule
```

Potential structure:

### players

```text
id
name
display_name
created_at
updated_at
```

### tournaments

```text
id
name
type
status
date
location
description
created_by
created_at
updated_at
```

### teams

```text
id
tournament_id
name
created_at
```

### team_players

```text
id
team_id
player_id
```

### matches

```text
id
tournament_id
round
team_a_id
team_b_id
winner_team_id
status
scheduled_position
court_number
started_at
completed_at
```

### match_games

```text
id
match_id
game_number
team_a_score
team_b_score
winner_team_id
```

### match_rallies

```text
id
match_id
game_number
rally_number
winning_team_id
team_a_score
team_b_score
server_player_id
receiver_player_id
created_at
```

### match_positions

Store position state whenever necessary to allow complete reconstruction/undo.

---

# 40. Tournament State Machine

Use explicit tournament states:

```text
DRAFT
READY
LIVE
PAUSED
COMPLETED
CANCELLED
```

Match states:

```text
SCHEDULED
READY
LIVE
PAUSED
COMPLETED
SKIPPED
```

Do not rely on arbitrary boolean fields for workflow state.

---

# 41. Important Validation Rules

Implement proper frontend and backend validation.

Examples:

### Players

```text
At least 2 players.
Player count must be even for automatic doubles team generation.
```

### Teams

```text
Exactly 2 players per team.
No duplicate player in tournament.
```

### League

```text
At least 2 teams.
```

### Knockout

If number of teams is not a power of two:

```text
4
8
16
32
```

Support byes.

Example:

```text
10 teams
```

Automatically generate appropriate first-round byes rather than rejecting the tournament.

Randomly assign byes where appropriate.

---

# 42. Error Handling

Use clear user-friendly messages.

Examples:

```text
"Please enter an even number of players to create doubles teams."

"Each doubles team must contain exactly 2 players."

"This player is already assigned to another team."

"At least 2 teams are required to start a tournament."

"This match cannot be started because the opponent has not been determined yet."

"Cannot complete this match without selecting a server and receiver."
```

Avoid technical/database errors being shown directly to the user.

---

# 43. Authentication

Initially support:

```text
Admin / Organizer
```

The organizer should be able to:

* Create tournaments
* Manage players
* Manage teams
* Start matches
* Edit schedules
* Record scores
* Correct results
* View statistics

Design the architecture so spectator/read-only access can be added later.

---

# 44. Audit Trail

For important changes, store:

```text
created_by
updated_by
created_at
updated_at
```

For match corrections, record:

```text
who changed it
when
what was changed
```

This is particularly important because match results affect tournament standings.

---

# 45. UI/UX Requirements

The UI should be modern and minimal.

Use:

* Cards
* Tabs
* Tables
* Dialogs
* Drawers
* Toast notifications
* Confirmation dialogs
* Progress indicators
* Badges for status

Tournament colors should feel sporty but professional.

Avoid excessive animations except where useful.

The coin toss can have a noticeable animation.

---

# 46. Live Scoring UX

The live scoring screen should prioritize:

1. Score
2. Point buttons
3. Server
4. Receiver
5. Court positions
6. Game status
7. Undo
8. Match controls

The organizer should be able to record a rally with **one large tap**.

Example:

```text
              18
          TEAM A

       [ TEAM A +1 ]


       [ TEAM B +1 ]

          TEAM B
              17
```

After tapping, everything else should automatically update.

---

# 47. Court Visualization

Create a reusable BadmintonCourt component.

Example:

```text
        TEAM B SIDE

┌──────────────────────────┐
│                                                                                   │
│    Arun                                            Vijay                 │                                   
│                                                                                    │
│                                                                                    │
├──────────────────────────┤
│                                     NET                                       │                        
├──────────────────────────┤
│                                                                                    │
│    Rahul                                           Kiran                │                                               
│                                                                                    │
└──────────────────────────┘

        TEAM A SIDE
```

Highlight:

* Server
* Receiver
* Server partner
* Receiver partner
* Current service court

Use clear visual labels.

On mobile, the court can be simplified while retaining the correct position information.

---

# 48. Match Information Sidebar

On desktop, show:

```text
Match Information

Tournament:
Local Championship

Round:
Semi Final

Court:
Court 1

Server:
Rahul

Receiver:
Arun

Current Service Court:
Right

Score:
18 - 17
```

On mobile, place this information below the court.

---

# 49. Match Statistics

After a match, display:

```text
Match Statistics

Team A
Points Won: 63
Games Won: 2

Team B
Points Won: 55
Games Won: 1

Longest Game:
24 - 22

Highest Lead:
8 points
```

Potential future statistics:

* Rally count
* Winning streaks
* Service streaks
* Comebacks
* Average points per game

Design the database so these can be added later.

---

# 50. Data Integrity

Important:

The backend must never blindly trust the frontend score.

Validate match transitions on the backend.

For example:

```text
Current score = 20 - 20

Team A scores

New score = 21 - 20

Game is NOT over.

Team A scores

New score = 22 - 20

Team A wins.
```

At:

```text
29 - 29
```

next point must end the game:

```text
30 - 29
```

Do not allow:

```text
31 - 29
```

---

# 51. Undo Architecture

Implement rally history using immutable state snapshots or event sourcing.

Each rally should capture enough information to restore:

```text
previous score
new score
previous server
new server
previous receiver
new receiver
previous player positions
new player positions
game number
match status
```

Undo should reverse exactly one rally.

If the user refreshes the page, undo should still work for previously stored rallies.

---

# 52. Match Event Model

Consider modeling every match action as an event:

```text
TOSS_COMPLETED
SERVER_SELECTED
MATCH_STARTED
RALLY_WON
GAME_COMPLETED
GAME_STARTED
MATCH_COMPLETED
MATCH_PAUSED
MATCH_RESUMED
MATCH_UNDO
```

This will make the application easier to extend and audit.

---

# 53. API Design

Create clean APIs.

Example:

```text
POST /api/tournaments
GET /api/tournaments
GET /api/tournaments/:id

POST /api/tournaments/:id/players
POST /api/tournaments/:id/teams

POST /api/tournaments/:id/generate-random-teams
POST /api/tournaments/:id/shuffle-teams

POST /api/tournaments/:id/generate-fixtures
GET /api/tournaments/:id/matches

POST /api/matches/:id/start
POST /api/matches/:id/toss
POST /api/matches/:id/point
POST /api/matches/:id/undo
POST /api/matches/:id/pause
POST /api/matches/:id/resume
POST /api/matches/:id/complete

GET /api/tournaments/:id/standings
GET /api/players/:id/statistics
GET /api/leaderboards
```

Use appropriate HTTP methods and validation.

---

# 54. Random Team Algorithm

The random team generator should:

1. Collect all players.
2. Shuffle players using a proper randomization algorithm.
3. Pair adjacent players.
4. Generate teams.
5. Detect duplicate previous arrangements.
6. Display the result.

Example:

```typescript
shuffle(players)

for (let i = 0; i < players.length; i += 2) {
    createTeam(players[i], players[i + 1])
}
```

Use Fisher-Yates shuffle.

---

# 55. Fixture Generation

For league:

Generate every unique pair of teams exactly once.

Never generate:

```text
Team A vs Team B
Team B vs Team A
```

as two separate fixtures.

For knockout:

Generate the bracket and handle byes.

---

# 56. Responsive Navigation

Desktop:

```text
Sidebar
Dashboard
Tournaments
Players
Leaderboards
Settings
```

Mobile:

```text
Bottom navigation or hamburger menu
```

During live scoring, minimize navigation distractions.

---

# 57. Tournament Overview

Tournament details page:

```text
Local Badminton Championship

Status:
LIVE

Type:
League

Teams:
8

Matches:
28

Completed:
14

Remaining:
14
```

Tabs:

```text
Overview
Teams
Schedule
Standings
Results
Statistics
```

---

# 58. Schedule UI

Use a timeline/list.

Example:

```text
COMPLETED

Match 1
Team A 21 - 17 Team B
Winner: Team A

LIVE

Match 15
Team C vs Team D
18 - 17

UP NEXT

Match 16
Team E vs Team F

UPCOMING

Match 17
Team G vs Team H
```

Provide a clear "Next Match" action.

---

# 59. Organizer Controls

Provide a floating or easily accessible organizer menu:

```text
Pause Tournament
Reorder Schedule
Correct Match Result
Reset Match
Cancel Tournament
```

Dangerous actions must require confirmation.

---

# 60. Seed / Randomization Options

Before tournament start, allow:

```text
Randomize Teams
Randomize Knockout Bracket
Randomize Match Schedule
```

Once the tournament begins, randomization should be disabled unless explicitly resetting the tournament.

---

# 61. Important Distinction: Team vs Match Position

Do not permanently assign players to a court position.

A player has:

```text
Team membership
```

and separately has:

```text
Current match position
```

A player may be:

```text
Server
Receiver
Left court
Right court
Partner
```

depending on the current match state.

This distinction is essential.

---

# 62. Important Distinction: Schedule vs Bracket

For knockout tournaments:

```text
Bracket progression
```

and

```text
Playing schedule
```

must be separate.

Example:

A Semi Final might technically depend on Quarter Finals 1 and 2, but the organizer may choose to play another available match first.

The application should allow this without breaking bracket progression.

---

# 63. Future Features — Design For Extensibility

Do not necessarily implement these in version 1, but keep the architecture extensible for:

* Multiple courts
* Multiple simultaneous matches
* Spectator mode
* Public tournament URL
* Live score sharing
* QR code for tournament
* Player login
* Player profiles
* Player ratings
* Elo-style ranking
* Doubles partner history
* Tournament registration
* Entry fees
* Payment integration
* Notifications
* WhatsApp sharing
* Live scoreboard display on TV
* Tournament PDF report
* Match recording
* Advanced player analytics

---

# 64. Security

Implement:

* Authentication
* Authorization
* Backend validation
* Input sanitization
* Database constraints
* Secure API endpoints

Only authorized organizers should be able to modify tournament results.

Do not expose administrative operations to unauthenticated users.

---

# 65. Testing Requirements

Create unit tests for the badminton scoring engine.

At minimum test:

### Normal scoring

```text
0-0 → 1-0
1-0 → 1-1
```

### 20-20

```text
20-20
21-20
22-20 → game ends
```

### Extended deuce

```text
20-20
21-21
22-22
23-23
24-24
25-23 → game ends
```

### 29-29

```text
29-29
30-29 → game ends
```

### Never allow

```text
30-30
31-29
```

### Serving

Test:

* Serving team wins rally.
* Receiving team wins rally.
* Server changes correctly.
* Receiver changes correctly.
* Service court changes correctly.
* Even score → right service court.
* Odd score → left service court.

### Match

Test:

```text
Team A wins Game 1
Team B wins Game 2
Team A wins Game 3
→ Team A wins match
```

---

# 66. Seed Data

For development, create sample data:

```text
12 players
6 teams
1 knockout tournament
1 league tournament
Several completed matches
1 live match
```

This allows the UI to be demonstrated immediately.

---

# 67. Empty States

Every page should have useful empty states.

Example:

```text
No tournaments yet.

Create your first tournament to get started.

[ Create Tournament ]
```

Players:

```text
No players found.

[ Add Player ]
```

Matches:

```text
No matches scheduled.
```

---

# 68. Loading States

Use skeleton loaders/spinners where appropriate.

Do not show blank screens while data is loading.

---

# 69. Confirmation Dialogs

For destructive operations:

```text
Are you sure?

Resetting this match will remove the current score and match state.

[ Cancel ] [ Reset Match ]
```

For tournament completion:

```text
Are you sure you want to complete this tournament?
This action will finalize standings and results.
```

---

# 70. Overall User Flow

The main flow should be:

```text
Dashboard
   ↓
Create Tournament
   ↓
Enter Players
   ↓
Choose Team Creation Method
   ↓
Random Teams OR Manual Teams
   ↓
Confirm Teams
   ↓
Choose Knockout / League
   ↓
Generate Matches
   ↓
Review Schedule
   ↓
Start Tournament
   ↓
Next Match
   ↓
Coin Toss
   ↓
Choose Court / Serve
   ↓
Select Server
   ↓
Select Receiver
   ↓
Live Match
   ↓
Record Rally
   ↓
Automatic Score + Position Update
   ↓
Game Complete
   ↓
Next Game
   ↓
Match Complete
   ↓
Update Standings / Bracket
   ↓
Next Match
   ↓
Tournament Complete
   ↓
Winner + Results + Statistics
```

---

# 71. Critical Implementation Requirement

Before building the complete UI, first implement the badminton rules engine independently.

Create and test:

```text
BadmintonScoringEngine
```

with deterministic unit tests.

Then integrate the engine into the React UI.

Do not build the scoring behavior directly inside UI components.

The engine should receive state and an action and return the new state.

Conceptually:

```typescript
const newState = badmintonEngine.applyAction(
    currentState,
    {
        type: "RALLY_WON",
        winningTeam: teamA
    }
);
```

The returned state should contain:

```typescript
{
    score,
    gameNumber,
    gamesWon,
    serverPlayer,
    receiverPlayer,
    playerPositions,
    serviceCourt,
    status,
    winner
}
```

This architecture will make the application much easier to test and maintain.

---

# 72. Development Approach

Build the application in phases.

## Phase 1

Build:

* Project setup
* Database
* Authentication
* Player management
* Tournament creation
* Team creation
* Random team generator
* Manual team creation

## Phase 2

Build:

* Knockout bracket
* League fixture generation
* Match scheduling
* Schedule reordering
* Tournament state management

## Phase 3

Build:

* Coin toss
* Court selection
* Server/receiver selection
* Badminton scoring engine
* Doubles position tracking
* Live scoring

## Phase 4

Build:

* Standings
* Results
* Player statistics
* Leaderboards

## Phase 5

Build:

* Error handling
* Audit history
* Mobile optimization
* Testing
* Performance improvements
* UI polish

---

# 73. Acceptance Criteria

The application will be considered successful when the following scenario works end-to-end.

League Tournament Scenario

Organizer enters:

8 players

Application randomly generates:

4 doubles teams

Organizer can shuffle the teams.

Organizer selects:

League

Organizer configures the regular league match format:

Best of 1

or:

Best of 3

Default:

Best of 1

Application generates:

6 regular league matches

Organizer starts the tournament.

Application shows:

Match 1
Team A vs Team B

Organizer starts the match.

Application performs:

Coin Toss
→ Toss Winner
→ Court/Serve choice
→ Server selection
→ Receiver selection

Match begins.

Organizer taps:

Team A +1

Application automatically:

* Updates score.
* Determines serving status.
* Updates server.
* Updates receiver.
* Updates service court.
* Updates player positions.
* Stores rally history.

Continue until the configured match format is completed.

For Best of 1:

Team A 21 - 18 Team B

For Best of 3:

Team A wins 2 games.

Application:

* Declares the match winner.
* Updates league standings.
* Updates matches played.
* Updates wins/losses.
* Adds 2 points to the winning team.
* Updates point difference.
* Updates player statistics.
* Moves to the next scheduled league match.

If organizer skips Match 2:

Move Match 2 to position 5

the application must correctly update the schedule without changing the league fixture relationships.

After all regular league matches are completed:

Final League Standings

must be calculated.

The application must identify:

1st Position Team
2nd Position Team

and automatically create:

LEAGUE FINAL

1st Position Team
VS
2nd Position Team

Format:
Best of 1

The final is then played using the same:

Coin Toss
→ Court/Serve Choice
→ Server
→ Receiver
→ Live Scoring
→ Position Tracking
→ Match Completion

After the final:

TOURNAMENT CHAMPION

must be the winner of the League Final.

The team that finished 1st in the league table is not automatically the champion.

The team that finished 2nd in the league table can become champion by winning the final.

Example:

League Table

1. Team A
2. Team B
3. Team C
4. Team D

       ↓

Final

Team A 18 - 21 Team B

       ↓

Champion:
Team B

Runner-up:
Team A

The final result must not change the regular league standings.

The application should clearly distinguish:

League Standings

from:

Final Tournament Result

---

# 74. Final Product Goal

Build this as a real tournament management application, not merely a demo.

The application should make it possible for one organizer standing beside a badminton court to manage an entire doubles tournament from player registration through the final match.

The most important requirements are:

1. Correct badminton doubles rules.
2. Correct scoring.
3. Configurable regular match format:
        * Best of 1 by default.
        * Best of 3 as an option.
4. League tournaments must generate all round-robin fixtures.
5. Correct league standings.
6. After all league matches, automatically qualify 1st and 2nd place for the League Final.
7. League Final must always be Best of 1.
8. League Final winner becomes the Tournament Champion.
9. League Final result must not modify regular league standings.
10. Correct server/receiver tracking.
11. Correct player court-position tracking.
12. Reliable match state.
13. Flexible match scheduling.
14. Correct knockout progression.
15. Persistent player statistics across tournaments.
16. Excellent mobile/tablet live-scoring experience.

When implementing any badminton rule, prioritize correctness and deterministic state transitions over visual shortcuts.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5b8b79d1-318d-4948-ac31-bb5b2ec6b4b7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
