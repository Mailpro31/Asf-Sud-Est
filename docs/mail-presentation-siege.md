# Mail de présentation — Portail documentaire ASF / Les Ailes du Sourire

**À :** Responsable Les Ailes du Sourire · Responsable informatique — Aviation Sans Frontières (Siège, Paris)
**De :** [Votre nom], ASF Sud-Est
**Objet :** Présentation d'un portail web pour centraliser et fiabiliser les dossiers de vol — Les Ailes du Sourire

---

Bonjour,

Je me permets de vous présenter un projet développé au sein de la délégation **ASF Sud-Est**, pensé pour le programme **Les Ailes du Sourire**, et qui pourrait, je le crois, bénéficier à l'ensemble de l'association.

## Le constat de départ

Aujourd'hui, la gestion des **autorisations et des justificatifs de vol** des organismes partenaires repose sur des échanges dispersés (e-mails, pièces jointes, tableurs, relances manuelles). Cette dispersion fait perdre du temps aux coordinateurs, complique le suivi de la conformité d'un dossier, et retarde le moment où un vol peut être autorisé.

L'idée du projet est simple : **tout centraliser au même endroit, sur un seul site internet sécurisé**, de la transmission des documents par le partenaire jusqu'à la validation par ASF.

## La solution : un portail documentaire unique

Il s'agit d'une **application web sécurisée** où chaque acteur dispose de son propre espace, adapté à son rôle. Un partenaire dépose ses pièces, l'antenne locale les contrôle et les valide, et la coordination garde une vision d'ensemble en temps réel. Quand le dossier est complet et validé, le vol Les Ailes du Sourire peut être autorisé.

Le tout est **accessible depuis un navigateur** (ordinateur, tablette, téléphone), sans aucune installation.

👉 **Le portail est en ligne et consultable dès maintenant : https://asf-sud-est.vercel.app**

## Trois espaces, trois rôles

Le portail s'articule autour de **trois panneaux d'administration** complémentaires :

### 1. L'espace Partenaire (organismes)
Destiné aux associations et organismes qui accompagnent les bénéficiaires. Ils peuvent :
- déposer leurs documents de vol (glisser-déposer, tous formats) et les **classer dans des dossiers** ;
- suivre en direct l'**état de chaque pièce** (en attente, validé, à corriger) ;
- **soumettre leur dossier** à leur antenne pour revue en un clic ;
- recevoir les **demandes de correction** avec le motif précis ;
- consulter les **informations de leur antenne** de rattachement (contact, coordinateur, aérodrome).

### 2. L'espace Gestionnaire d'antenne
Destiné aux coordinateurs locaux. Chaque antenne gère **ses propres** organismes partenaires :
- validation ou demande de correction **document par document** ;
- vue claire des **dossiers soumis à traiter** et des organismes à valider ;
- **profil de l'antenne** modifiable (coordonnées, coordinateur, flotte) — visible par ses membres ;
- **journal d'activité** retraçant chaque action ;
- réglages de **notifications par e-mail** à chaque nouveau dépôt.

### 3. L'espace Coordination (super administrateur)
Vue d'ensemble nationale / par délégation :
- **taux de conformité** et indicateurs par antenne et par organisme ;
- tableau de bord dédié **Les Ailes du Sourire** ;
- gestion des **implantations** (antennes sur la carte) ;
- **dépôt de fichiers directement sur une antenne** et **export** des dossiers (CSV, archive ZIP) ;
- supervision de l'ensemble du réseau depuis un point unique.

## Les fonctionnalités essentielles

- **Centralisation** de tous les documents au même endroit, fini les pièces jointes éparpillées.
- **Circuit de validation clair** : trois statuts (En attente · Validé · À corriger).
- **Notifications** à chaque action importante (dépôt, création de dossier, nouvel organisme, soumission de dossier) — via une **cloche** dans l'application et par **e-mail**.
- **Aperçu intégré** de tous les types de fichiers et **téléchargement** (individuel ou en archive).
- **Suivi de la conformité** en temps réel, avec relances facilitées.
- **Accès par rôle** : chacun ne voit que ce qui le concerne.
- **Visite guidée** intégrée pour une prise en main immédiate, **mode sombre** et **affichage responsive**.

## Le volet technique (pour le responsable informatique)

- **Front-end** : React + TypeScript (Vite), interface Tailwind CSS — moderne, rapide, maintenable.
- **Back-end** : **Firebase** (Authentification, base de données Firestore, stockage de fichiers).
- **Sécurité** : authentification obligatoire et **règles d'accès déployées** garantissant que chaque utilisateur n'accède qu'à ses données (cloisonnement par organisme / antenne / délégation), avec un **journal d'audit** des actions.
- **Hébergement** web standard (déploiement continu), **sans installation** côté utilisateur.
- **Robustesse** : un mode de sauvegarde de secours assure la continuité même en cas d'indisponibilité ponctuelle du stockage.

## Pourquoi c'est intéressant pour ASF

- **Gain de temps logistique** pour les coordinateurs : moins de relances, moins de ressaisie.
- **Fiabilité et traçabilité** : on sait à tout moment où en est chaque dossier et qui a fait quoi.
- **Autorisations de vol plus rapides** : un dossier complet et validé, c'est un vol qui peut décoller plus tôt.
- **Déjà fonctionnel** sur le périmètre Sud-Est, et **conçu pour s'étendre** aux autres délégations et programmes (Les Ailes de l'Avenir, missions avions…).
- **Image** : un outil à la hauteur de la première ONG aéronautique d'utilité publique.

## Prochaine étape

Vous pouvez d'ores et déjà découvrir le portail en ligne : **https://asf-sud-est.vercel.app**

Je serais ravi de vous faire une **démonstration en visioconférence** (15-20 minutes) pour vous montrer le portail en conditions réelles et recueillir vos retours, notamment sur une éventuelle généralisation au niveau national.

Je reste à votre entière disposition.

Bien cordialement,

**[Votre nom]**
ASF Sud-Est — Les Ailes du Sourire
[Téléphone] · [E-mail]
