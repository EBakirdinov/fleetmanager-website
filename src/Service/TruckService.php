<?php

namespace App\Service;

class TruckService
{
    private $accountService;

    public function __construct(AccountService $accountService)
    {
        $this->accountService = $accountService;
    }

    public function getList(array $params = [])
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        $path = 'truck';
        if (!empty($params)) {
            $path .= '?' . http_build_query($params);
        }
        return $this->accountService->request($path, 'GET', null, $headers);
    }

    public function get($id)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('truck/' . $id, 'GET', null, $headers);
    }

    public function create(array $data)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('truck', 'POST', $data, $headers);
    }

    public function update($id, array $data)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('truck/' . $id, 'PATCH', $data, $headers);
    }

    public function delete($id)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('truck/' . $id, 'DELETE', null, $headers);
    }
}
