# Traduction en éwé de l'assistant

L'assistant répond en français. Aucun texte en éwé n'est publié tant qu'une personne de langue maternelle ne l'a pas écrit ou relu : une erreur sur un montant ou un retard ferait du tort à la personne qui lit.

## Ce qu'il faut faire

Traduire les phrases ci-dessous. Garder tel quel ce qui est entre accolades : l'application le remplace par un nombre, une date ou un nom.

Une fois la traduction reçue, il faudra la brancher dans `src/lib/assistantEngine.ts`, à partir de `profile.language === 'ee'`.

## Phrases

| Usage | Français |
|---|---|
| Score | Votre score est de {score}/100 : {niveau}. |
| Niveau | Très régulier |
| Niveau | Régulier |
| Niveau | À surveiller |
| Niveau | À redresser |
| Détail | {n} cotisations à l'heure sur {total}. |
| Détail | {n} en retard parmi les {total} dernières. |
| Détail | {n} échue(s) pas encore payée(s). |
| Limite | C'est une estimation, pas un jugement. |
| Variation | Votre score est passé de {avant} à {après} depuis le {date}. |
| Variation | Votre score n'a pas bougé : il reste à {score}/100. |
| Cause | Une plus grande part de vos cotisations a été payée en retard. |
| Cause | Une plus grande part de vos cotisations a été payée à l'heure. |
| Cause | Vous avez eu des retards sur vos 3 dernières cotisations. |
| Cause | Une cotisation échue n'est pas encore payée. |
| Cause | Vous avez réglé une cotisation en retard. |
| Conseil | Réglez d'abord votre cotisation en retard. |
| Conseil | Gardez le montant sur votre portefeuille avant la date : le prélèvement se fait tout seul. |
| Rappel | Votre cotisation de {montant} est attendue demain. |
| Rappel | Il manque {montant} sur votre portefeuille. |
| Vie privée | Votre score n'est visible que par vous et par l'équipe eganyé. |
| Vie privée | Il ne refuse rien tout seul : une personne décide toujours. |
| Pas de score | Il faut au moins {n} cotisations pour calculer votre score. |
| Incompris | Je n'ai pas compris. |
