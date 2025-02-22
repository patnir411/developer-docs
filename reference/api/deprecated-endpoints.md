# Deprecated Endpoints

The methods and endpoints of the **Realtime API** and **Rest API** that have been depreciated are listed below.

## Realtime API

| Method                | Release deprecated | Release removed |
| --------------------- | ------------------ | --------------- |
| `cleanChannelHistory` | 0.64.0             | 0.67.0          |
| `addOAuthApp`         | 6.0.0              | 6.0.0           |
| `canAccessRoom`       | 4.1.1              | 5.0.0           |

## REST API

### Endpoints to be deprecated

<table><thead><tr><th>Endpoint</th><th>Description</th><th width="181">Release deprecated</th><th>Release removed</th></tr></thead><tbody><tr><td><a href="https://developer.rocket.chat/reference/api/rest-api/endpoints/miscellaneous/licenses/get-licenses"><code>/licenses.get</code></a></td><td>The endpoint is replaced by <code>/licenses.info</code></td><td>6.5.0</td><td>7.0.0</td></tr><tr><td><a href="https://developer.rocket.chat/reference/api/rest-api/endpoints/miscellaneous/licenses/confirm-enterprise-license"><code>/licenses.isEnterprise</code></a></td><td>The endpoint is replaced by <code>/licenses.info</code></td><td>6.5.0</td><td>7.0.0</td></tr><tr><td><a href="https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-room/update-room-visitor-info"><code>/livechat/room.visitor</code></a></td><td>The endpoint will be removed.</td><td>6.5.0</td><td>7.0.0</td></tr><tr><td><a href="https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-inquiries/inquiries-queued"><code>/livechat/inquiries.queued</code></a></td><td>The endpoint will be removed.</td><td>6.5.0</td><td>7.0.0</td></tr></tbody></table>

### Removed endpoints

| Endpoint                 | Release deprecated | Release removed |
| ------------------------ | ------------------ | --------------- |
| `/livechat/office-hours` |                    | 5.0.0           |
| `/v1/info`               | 1.0.0              | 1.12.0          |
| `/emoji.custom`          | 1.0.0              | 1.12.0          |
| `/permissions.list`      | 0.73.0             | 1.11.0          |
| `/permissions`           | 0.66.0             | 0.69.0          |
| `/channels.cleanHistory` | 0.64.0             | 0.67.0          |
| `/user.roles`            | 0.63.0             | 0.66.0          |

### Renamed endpoints

| Endpoint                                          | Renamed endpoint                                                                                                                                                                                     | Release |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `/livechat/business-hours.list`                   | [`/livechat/business-hours`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/business-hours/get-business-hours)                                        | 5.0.0   |
| `/livechat/departments.available-by-unit/:unitId` | [`/livechat/units/:unitId/departments/available`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-units/get-available-departments-by-unit-id) | 5.0.0   |
| `/livechat/departments.by-unit/:unitId`           | [`/livechat/units/:unitId/departments`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-units/get-departments-by-unit-id)                     | 5.0.0   |
| `/livechat/monitors.list`                         | [`/livechat/monitors`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-monitors/get-list-of-monitors)                                         | 5.0.0   |
| `/livechat/units.getOne`                          | [`/livechat/monitors/:username`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-monitors/get-a-monitor)                                      | 5.0.0   |
| `/livechat/priorities.list`                       | [`/livechat/priorities`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-priorities/get-priorities)                                           | 5.0.0   |
| `/livechat/priority.getOne`                       | [`/livechat/priorities/:priorityId`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-priorities/get-a-priority)                               | 5.0.0   |
| `/livechat/tags.list`                             | [`/livechat/tags`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-tags/get-list-of-tags)                                                     | 5.0.0   |
| `/livechat/tags.getOne`                           | [`/livechat/tags/:tagId`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-tags/get-a-tag)                                                     | 5.0.0   |
| `/livechat/units.list`                            | [`/livechat/units`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-units/get-list-of-units)                                                  | 5.0.0   |
| `/livechat/units.getOne`                          | [`/livechat/units/:unitId`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-units/get-a-unit)                                                 | 5.0.0   |
| `/livechat/unitMonitors.list`                     | [`/livechat/units/:unitId/monitors`](https://developer.rocket.chat/reference/api/rest-api/endpoints/omnichannel/livechat-endpoints/livechat-units/get-list-of-unit-monitors)                         | 5.0.0   |
