# How would I know the readiness score is right?

**The score is a hypothesis, not a fact.** "Ready" only means something if it predicts what happens on exam day. So I would check it in four ways:

1. **Compare it with real outcomes.** The app gives a *chance of passing*, so it can be tested like a forecast. Ask learners for their Goethe/ÖSD result (pass/fail and points) 2–4 weeks after they take the check. Then group learners by the chance we gave them. Of those we said had about 85–99%, roughly that share should pass, and of those we said had about 25%, roughly a quarter should. If "Ready" learners fail more than ~10–15% of the time, the bar is too low. If almost nobody in "Not yet" ever fails, the bar is too high and we are scaring people off for nothing. With enough data I would also compute a Brier score and re-fit the 60% pass line and the weights.
2. **Compare it with an independent measure.** Have learners also take a full official sample paper (Goethe publishes them). If our score and the sample-paper score disagree by more than ~15 points for many people, a question or a weight is wrong.
3. **Check the questions themselves.** Once there are a few hundred attempts, look at each question. Does it separate strong from weak learners? Does almost everyone get it right or wrong? Do many pick "I don't know"? Remove or rewrite the ones that tell us nothing.
4. **Ask learners if it feels right.** The "Too high / About right / Too low" buttons on the results page are a cheap early signal, but I would not trust them alone. People are bad at judging themselves, and a learner who fails still wants to say it was "about right".

**This is already built in.** Version 1 stores each attempt anonymously, lets a learner reopen their result link after the exam to report "passed / didn't pass", and has an insights page that shows predicted vs actual pass rates and flags weak questions. So the checks above start running from the first real learner.

Known weaknesses today: 15 questions is noisy (that is why we show a range); the check does not test listening, writing or speaking; and the 60% pass line, the 85/60 cut-offs and the 40/30/30 weights are my reasoned guesses, not fitted to data yet.

# What I would ask five real learners before building version 2

I would talk to five learners who finished A1 recently, two who passed, two who failed and one who is still deciding. I would ask:

1. "Walk me through how you decided it was time to book the exam. Who or what told you that you were ready?"
2. "What did you do in the last 2 weeks before the exam? What do you wish you had practised?" (This tests whether our "practise this" advice matches reality.)
3. *(For those who failed)* "Which part went wrong, and did it surprise you? What would you have done differently if you had known beforehand?"
4. "Here is your result from my check. Do you believe it? Which part feels wrong?" (Show them the real screen and watch where they hesitate. Do not explain it first.)
5. "What would make you trust a readiness score enough to delay a booking? What would you want to see, and who else would you show it to?" (Many learners are influenced by trainers, family or an employer.)

Plus one number: "How much did the exam fee and the delay cost you?" That tells us how much a wrong "Ready" really hurts, and so how cautious the thresholds should be.
