<?php

namespace App\Service;

class TrailerService
{
    private $accountService;

    public function __construct(AccountService $accountService)
    {
        $this->accountService = $accountService;
    }

    public function getList(array $params = [])
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        $path = 'trailer';
        if (!empty($params)) {
            $path .= '?' . http_build_query($params);
        }
        return $this->accountService->request($path, 'GET', null, $headers);
    }

    public function get($id)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('trailer/' . $id, 'GET', null, $headers);
    }

    public function create(array $data)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('trailer', 'POST', $data, $headers);
    }

    public function update($id, array $data)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('trailer/' . $id, 'PATCH', $data, $headers);
    }

    public function delete($id)
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('trailer/' . $id, 'DELETE', null, $headers);
    }

    /**
     * Trailers with no assigned truck (available for assignment).
     */
    public function getAvailable()
    {
        $headers = $this->accountService->getAuthorizationHeaders();
        return $this->accountService->request('trailer/available', 'GET', null, $headers);
    }
}
